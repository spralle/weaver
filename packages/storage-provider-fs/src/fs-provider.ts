import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { deepMerge, deepRemove, deepSet } from "@weaver/config-engine";
import type {
  ConfigurationChange,
  ConfigurationLayer,
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";
import {
  isNodeError,
  safeParseConfigEntries,
} from "@weaver/storage-provider-core";
import { FsConfigWatcher } from "./fs-watcher.js";

export interface FileSystemProviderOptions {
  id: string;
  layer: ConfigurationLayer | string;
  filePath: string;
  writable?: boolean | undefined;
  environmentOverlayPath?: string | undefined;
  /** Debounce interval in ms for file-system watch events (default: 100). */
  watchDebounceMs?: number | undefined;
}

/** @see {@link createFileSystemStorageProvider} — prefer the factory function for consistency */
export class FileSystemStorageProvider implements ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: ConfigurationLayer | string;
  readonly writable: boolean;

  private readonly filePath: string;
  private readonly envOverlayPath: string | undefined;
  private readonly watchDebounceMs: number;
  private watcher: FsConfigWatcher | null = null;

  constructor(options: FileSystemProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.writable = options.writable ?? false;
    this.filePath = resolve(options.filePath);
    this.envOverlayPath = options.environmentOverlayPath
      ? resolve(options.environmentOverlayPath)
      : undefined;
    this.watchDebounceMs = options.watchDebounceMs ?? 100;
  }

  async load(): Promise<ConfigurationLayerData> {
    let entries = await this.readJsonFile(this.filePath);
    const revision = await this.getRevision(this.filePath);

    if (this.envOverlayPath) {
      const overlay = await this.readJsonFile(this.envOverlayPath);
      entries = deepMerge(entries, overlay);
    }

    const result: ConfigurationLayerData = { entries };
    if (revision !== undefined) {
      result.revision = revision;
    }
    return result;
  }

  async write(key: string, value: unknown): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }

    const entries = await this.readJsonFile(this.filePath);
    deepSet(entries, key, value);
    await this.atomicWrite(this.filePath, entries);

    const revision = await this.getRevision(this.filePath);
    return { success: true, revision };
  }

  async remove(key: string): Promise<WriteResult> {
    if (!this.writable) {
      return { success: false, error: "Provider is read-only" };
    }

    const entries = await this.readJsonFile(this.filePath);
    deepRemove(entries, key);
    await this.atomicWrite(this.filePath, entries);

    const revision = await this.getRevision(this.filePath);
    return { success: true, revision };
  }

  onExternalChange(
    listener: (changes: ConfigurationChange[]) => void,
  ): () => void {
    this.watcher?.dispose();
    const watcher = new FsConfigWatcher({
      filePath: this.filePath,
      debounceMs: this.watchDebounceMs,
    });
    this.watcher = watcher;

    // Load current state as baseline snapshot, then start watching
    void this.readJsonFile(this.filePath).then((entries) => {
      watcher.start(listener, entries);
    });

    return () => {
      watcher.dispose();
      if (this.watcher === watcher) this.watcher = null;
    };
  }

  dispose(): void {
    this.watcher?.dispose();
    this.watcher = null;
  }

  private async readJsonFile(path: string): Promise<Record<string, unknown>> {
    try {
      const content = await readFile(path, "utf-8");
      return safeParseConfigEntries(JSON.parse(content));
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        console.warn(`Invalid JSON in config file: ${path}`);
        return {};
      }
      if (isNodeError(err) && err.code === "ENOENT") {
        return {};
      }
      throw err;
    }
  }

  private async getRevision(path: string): Promise<string | undefined> {
    try {
      const stats = await stat(path);
      return stats.mtime.toISOString();
    } catch {
      return undefined;
    }
  }

  private async atomicWrite(
    path: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });
    const tmpPath = `${path}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    await rename(tmpPath, path);
  }
}

/** Creates a file-system-backed storage provider instance. */
export function createFileSystemStorageProvider(
  options: FileSystemProviderOptions,
): FileSystemStorageProvider {
  return new FileSystemStorageProvider(options);
}
