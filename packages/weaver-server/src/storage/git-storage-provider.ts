// GitStorageProvider — composes FileSystemStorageProvider for reads, GitManager for batched writes
import type {
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";
import { FileSystemStorageProvider } from "@weaver/config-server";
import type { GitManager } from "./git-manager.js";

export interface GitStorageProviderOptions {
  id: string;
  layer: string;
  gitManager: GitManager;
  filePath: string;
  environmentOverlayPath?: string | undefined;
  writable?: boolean | undefined;
}

export class GitStorageProvider implements ConfigurationStorageProvider {
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

    this.fsp = new FileSystemStorageProvider({
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
    await this.gitManager.commitAndPush(summary, [this.filePath]);
  }

  async refresh(): Promise<void> {
    await this.gitManager.pull();
  }
}
