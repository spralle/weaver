// GitStorageProvider — composes FileSystemStorageProvider for reads, GitManager for batched writes
import type {
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";
import { createFileSystemStorageProvider, type FileSystemStorageProvider } from "@weaver/storage-provider-fs";
import type { GitManager } from "./git-manager.js";

export interface GitStorageProviderOptions {
  id: string;
  layer: string;
  gitManager: GitManager;
  filePath: string;
  environmentOverlayPath?: string | undefined;
  writable?: boolean | undefined;
}

/** @see {@link createGitStorageProvider} — prefer the factory function for consistency */
class GitStorageProvider implements ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: string;
  readonly writable: boolean;

  private readonly fsp: FileSystemStorageProvider;
  private readonly gitManager: GitManager;
  private readonly filePath: string;
  private readonly dirtyKeys: string[] = [];
  private isDirty = false;

  constructor(options: GitStorageProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.writable = options.writable ?? true;
    this.gitManager = options.gitManager;
    this.filePath = options.filePath;

    const { join } = require("node:path") as typeof import("node:path");
    const absoluteFilePath = join(options.gitManager.localPath, options.filePath);
    const envOverlay = options.environmentOverlayPath
      ? join(options.gitManager.localPath, options.environmentOverlayPath)
      : undefined;

    this.fsp = createFileSystemStorageProvider({
      id: `${options.id}-fsp`,
      layer: options.layer,
      filePath: absoluteFilePath,
      writable: true,
      environmentOverlayPath: envOverlay,
    });
  }

  async load(): Promise<ConfigurationLayerData> {
    return this.fsp.load();
  }

  get dirty(): boolean {
    return this.isDirty;
  }

  async write(key: string, value: unknown): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }
    const result = await this.fsp.write(key, value);
    if (result.success) {
      this.dirtyKeys.push(`set ${key}`);
      this.isDirty = true;
    }
    return result;
  }

  async remove(key: string): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }
    const result = await this.fsp.remove(key);
    if (result.success) {
      this.dirtyKeys.push(`remove ${key}`);
      this.isDirty = true;
    }
    return result;
  }

  async flush(): Promise<void> {
    if (!this.isDirty) return;
    const summary =
      this.dirtyKeys.length === 1
        ? `config: ${this.dirtyKeys[0]}`
        : `config: ${this.dirtyKeys.length} changes in ${this.layer}`;
    this.dirtyKeys.length = 0;
    this.isDirty = false;
    const result = await this.gitManager.commitAndPush(summary, [this.filePath]);
    if (!result.success) {
      throw new Error(`Git flush failed: ${result.error}`);
    }
  }

  async revert(toRevision: string, actor: string): Promise<{ revertedCommits: number }> {
    const result = await this.gitManager.revert(toRevision, actor);
    if (!result.success) {
      throw new Error(`Git revert failed: ${result.error}`);
    }
    return result.data;
  }

  async refresh(): Promise<void> {
    const result = await this.gitManager.refresh();
    if (!result.success) {
      throw new Error(`Git refresh failed: ${result.error}`);
    }
  }
}

/** Creates a Git-backed storage provider instance. */
export function createGitStorageProvider(
  options: GitStorageProviderOptions,
): ConfigurationStorageProvider & { dirty: boolean; flush(): Promise<void>; revert(toRevision: string, actor: string): Promise<{ revertedCommits: number }>; refresh(): Promise<void> } {
  return new GitStorageProvider(options);
}
