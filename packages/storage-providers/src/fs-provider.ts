import { type FSWatcher, watch } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  deepMerge,
  deepRemove,
  deepSet,
  isNodeError,
  safeParseConfigEntries,
} from "@weaver/config-engine";
import type {
  ConfigurationChange,
  ConfigurationLayer,
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";

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
  private fsWatcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshot: Record<string, unknown> = {};
  private changeListener: ((changes: ConfigurationChange[]) => void) | null =
    null;

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

    this.snapshot = JSON.parse(JSON.stringify(entries));

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

    this.snapshot = JSON.parse(JSON.stringify(entries));

    const revision = await this.getRevision(this.filePath);
    return { success: true, revision };
  }

  onExternalChange(
    listener: (changes: ConfigurationChange[]) => void,
  ): () => void {
    this.stopWatching();
    this.changeListener = listener;

    void this.readJsonFile(this.filePath).then((entries) => {
      if (!this.changeListener) return;
      this.snapshot = entries;
      this.startWatching();
    });

    return () => this.stopWatching();
  }

  dispose(): void {
    this.stopWatching();
  }

  private startWatching(): void {
    const dir = dirname(this.filePath);
    const filename = this.filePath.slice(dir.length + 1);

    this.fsWatcher = watch(dir, (_eventType, changedFile) => {
      if (changedFile !== filename) return;
      this.scheduleCheck();
    });
  }

  private stopWatching(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
    this.changeListener = null;
  }

  private scheduleCheck(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.checkForChanges();
    }, this.watchDebounceMs);
    this.debounceTimer.unref();
  }

  private async checkForChanges(): Promise<void> {
    if (!this.changeListener) return;

    const current = await this.readJsonFile(this.filePath);
    const changes = diffEntries(this.snapshot, current);

    if (changes.length > 0) {
      this.snapshot = current;
      this.changeListener(changes);
    }
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

/** Shallow diff of top-level keys between two entry maps. */
function diffEntries(
  oldEntries: Record<string, unknown>,
  newEntries: Record<string, unknown>,
): ConfigurationChange[] {
  const changes: ConfigurationChange[] = [];
  const allKeys = new Set([
    ...Object.keys(oldEntries),
    ...Object.keys(newEntries),
  ]);

  for (const key of allKeys) {
    const oldVal = oldEntries[key];
    const newVal = newEntries[key];
    if (!deepEqual(oldVal, newVal)) {
      changes.push({ key, oldValue: oldVal, newValue: newVal });
    }
  }

  return changes;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;
  if (aIsArray && bIsArray) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  const aObj = a as Record<string, unknown>; // SAFETY: confirmed non-null, non-array objects above
  const bObj = b as Record<string, unknown>; // SAFETY: confirmed non-null, non-array objects above
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
}
