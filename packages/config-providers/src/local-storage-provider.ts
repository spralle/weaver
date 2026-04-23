// localStorage-backed configuration storage provider — USER and DEVICE layers

import type {
  ConfigurationChange,
  ConfigurationLayer,
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  WriteResult,
} from "@weaver/config-types";

export interface LocalStorageProviderOptions {
  id: string;
  layer: ConfigurationLayer | string;
  storageKey: string;
  storage?: Storage | undefined;
}

export class LocalStorageProvider implements ConfigurationStorageProvider {
  readonly id: string;
  readonly layer: ConfigurationLayer | string;
  readonly writable = true as const;

  private readonly storageKey: string;
  private readonly storage: Storage;

  constructor(options: LocalStorageProviderOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.storageKey = options.storageKey;
    this.storage = options.storage ?? localStorage;
  }

  async load(): Promise<ConfigurationLayerData> {
    const raw = this.storage.getItem(this.storageKey);
    if (raw === null) {
      return { entries: {} };
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        console.warn(
          `[LocalStorageProvider] Invalid data in "${this.storageKey}", expected object`,
        );
        return { entries: {} };
      }
      return { entries: parsed as Record<string, unknown> };
    } catch {
      console.warn(
        `[LocalStorageProvider] Corrupt JSON in "${this.storageKey}", returning empty`,
      );
      return { entries: {} };
    }
  }

  async write(key: string, value: unknown): Promise<WriteResult> {
    try {
      const current = await this.loadEntries();
      current[key] = value;
      this.storage.setItem(this.storageKey, JSON.stringify(current));
      return { success: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown write error";
      return { success: false, error: message };
    }
  }

  async remove(key: string): Promise<WriteResult> {
    try {
      const current = await this.loadEntries();
      delete current[key];
      this.storage.setItem(this.storageKey, JSON.stringify(current));
      return { success: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown remove error";
      return { success: false, error: message };
    }
  }

  onExternalChange(
    listener: (changes: ConfigurationChange[]) => void,
  ): () => void {
    if (typeof addEventListener !== "function") {
      // No event support (e.g. Node.js) — return no-op cleanup
      return () => {};
    }

    const handler = (event: StorageEvent): void => {
      if (event.key !== this.storageKey) return;

      const oldEntries = this.parseOrEmpty(event.oldValue);
      const newEntries = this.parseOrEmpty(event.newValue);

      const changes: ConfigurationChange[] = [];
      const allKeys = new Set([
        ...Object.keys(oldEntries),
        ...Object.keys(newEntries),
      ]);

      for (const k of allKeys) {
        const oldValue: unknown = oldEntries[k];
        const newValue: unknown = newEntries[k];
        if (oldValue !== newValue) {
          changes.push({ key: k, oldValue, newValue });
        }
      }

      if (changes.length > 0) {
        listener(changes);
      }
    };

    addEventListener("storage", handler as EventListener);
    return () => {
      removeEventListener("storage", handler as EventListener);
    };
  }

  private async loadEntries(): Promise<Record<string, unknown>> {
    const data = await this.load();
    return data.entries;
  }

  private parseOrEmpty(raw: string | null): Record<string, unknown> {
    if (raw === null) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
}
