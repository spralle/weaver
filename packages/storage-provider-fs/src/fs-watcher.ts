import { watch, type FSWatcher } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ConfigurationChange } from "@weaver/config-types";
import { safeParseConfigEntries } from "@weaver/storage-provider-core";

export interface FsWatcherOptions {
  filePath: string;
  debounceMs?: number;
}

/**
 * Watches a config file for external changes, debounces events,
 * and diffs against a snapshot to emit only actually changed keys.
 */
export class FsConfigWatcher {
  private readonly filePath: string;
  private readonly debounceMs: number;
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshot: Record<string, unknown> = {};
  private listener: ((changes: ConfigurationChange[]) => void) | null = null;

  constructor(options: FsWatcherOptions) {
    this.filePath = options.filePath;
    this.debounceMs = options.debounceMs ?? 100;
  }

  /**
   * Start watching. Returns an unsubscribe function.
   * Only one listener is supported at a time.
   */
  start(
    listener: (changes: ConfigurationChange[]) => void,
    initialSnapshot: Record<string, unknown>,
  ): () => void {
    this.listener = listener;
    this.snapshot = { ...initialSnapshot };

    const dir = dirname(this.filePath);
    const filename = this.filePath.slice(dir.length + 1);

    this.watcher = watch(dir, (eventType, changedFile) => {
      if (changedFile !== filename) return;
      this.scheduleCheck();
    });

    return () => this.dispose();
  }

  /** Update the internal snapshot (call after provider's own writes). */
  updateSnapshot(entries: Record<string, unknown>): void {
    this.snapshot = { ...entries };
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.listener = null;
  }

  private scheduleCheck(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.checkForChanges();
    }, this.debounceMs);
  }

  private async checkForChanges(): Promise<void> {
    if (!this.listener) return;

    const current = await this.readFile();
    const changes = diffEntries(this.snapshot, current);

    if (changes.length > 0) {
      this.snapshot = current;
      this.listener(changes);
    }
  }

  private async readFile(): Promise<Record<string, unknown>> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      return safeParseConfigEntries(JSON.parse(content));
    } catch {
      return {};
    }
  }
}

/** Shallow diff of top-level keys between two flat entry maps. */
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

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
}
