// GitStorageProvider — composes FileSystemStorageProvider for reads, simple-git for writes
import type { SimpleGit } from "simple-git";
import type {
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";
import { FileSystemStorageProvider } from "@weaver/config-server";
import type { GitWriteQueue } from "../git/write-queue.js";

export interface GitStorageProviderOptions {
  id: string;
  layer: string;
  repoPath: string;
  filePath: string;
  environmentOverlayPath?: string | undefined;
  writeQueue: GitWriteQueue;
  git: SimpleGit;
  writable?: boolean | undefined;
}

export class GitStorageProvider implements ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: string;
  readonly writable: boolean;

  private readonly fsp: FileSystemStorageProvider;
  private readonly writeQueue: GitWriteQueue;
  private readonly git: SimpleGit;
  private readonly repoPath: string;
  private readonly filePath: string;

  constructor(options: GitStorageProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.writable = options.writable ?? true;
    this.writeQueue = options.writeQueue;
    this.git = options.git;
    this.repoPath = options.repoPath;
    this.filePath = options.filePath;

    const { join } = require("node:path") as typeof import("node:path");
    const absoluteFilePath = join(options.repoPath, options.filePath);
    const envOverlay = options.environmentOverlayPath
      ? join(options.repoPath, options.environmentOverlayPath)
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

  async write(key: string, value: unknown): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }

    return this.writeQueue.enqueue(async () => {
      const result = await this.fsp.write(key, value);
      if (!result.success) return result;

      await this.git.cwd(this.repoPath);
      await this.git.add(this.filePath);
      await this.git.commit(`config: set ${key}`);
      await this.git.pull(["--rebase"]);
      await this.git.push();

      return result;
    });
  }

  async remove(key: string): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }

    return this.writeQueue.enqueue(async () => {
      const result = await this.fsp.remove(key);
      if (!result.success) return result;

      await this.git.cwd(this.repoPath);
      await this.git.add(this.filePath);
      await this.git.commit(`config: remove ${key}`);
      await this.git.pull(["--rebase"]);
      await this.git.push();

      return result;
    });
  }
}
