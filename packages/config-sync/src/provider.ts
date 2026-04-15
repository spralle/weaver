import type {
  ConfigurationChange,
  ConfigurationLayer,
  ConfigurationLayerData,
  SyncResult,
  SyncStatus,
  WriteResult,
} from "@weaver/config-types";
import { createConfigSyncOrchestrator } from "./orchestrator.js";
import type {
  ConfigSyncOrchestrator,
  ConfigSyncOrchestratorOptions,
  SyncDiagnostics,
  SyncableConfigStorageProvider,
} from "./types.js";

export interface SyncableStorageProviderAdapterOptions extends ConfigSyncOrchestratorOptions {
  id: string;
  layer: ConfigurationLayer | string;
}

export class SyncableStorageProviderAdapter implements SyncableConfigStorageProvider {
  readonly id: string;
  readonly layer: ConfigurationLayer | string;
  readonly writable = true as const;

  private readonly orchestrator: ConfigSyncOrchestrator;
  private readonly externalChangeListeners = new Set<(changes: ConfigurationChange[]) => void>();
  private loadedSnapshot: ConfigurationLayerData = { entries: {} };

  constructor(options: SyncableStorageProviderAdapterOptions) {
    this.id = options.id;
    this.layer = options.layer;
    this.orchestrator = createConfigSyncOrchestrator(options);
  }

  get syncState(): SyncStatus {
    return this.orchestrator.getSyncState();
  }

  get pendingWrites(): ReadonlyMap<string, unknown> {
    return this.orchestrator.getPendingWrites();
  }

  async load(): Promise<ConfigurationLayerData> {
    this.loadedSnapshot = await this.orchestrator.load();
    return this.cloneSnapshot(this.loadedSnapshot);
  }

  async write(key: string, value: unknown): Promise<WriteResult> {
    await this.orchestrator.write(key, value);
    this.emitExternalChange([{ key, oldValue: undefined, newValue: value }]);
    return { success: true };
  }

  async remove(key: string): Promise<WriteResult> {
    const before = this.loadedSnapshot.entries[key];
    await this.orchestrator.remove(key);
    this.emitExternalChange([{ key, oldValue: before, newValue: undefined }]);
    return { success: true };
  }

  sync(): Promise<SyncResult> {
    return this.orchestrator.sync();
  }

  onSyncStateChange(listener: (state: SyncStatus) => void): () => void {
    return this.orchestrator.onSyncStateChange(listener);
  }

  onExternalChange(listener: (changes: ConfigurationChange[]) => void): () => void {
    this.externalChangeListeners.add(listener);
    return () => {
      this.externalChangeListeners.delete(listener);
    };
  }

  getSyncDiagnostics(): SyncDiagnostics {
    return this.orchestrator.getDiagnostics();
  }

  onSyncDiagnosticsChange(listener: (diagnostics: SyncDiagnostics) => void): () => void {
    return this.orchestrator.onDiagnosticsChange(listener);
  }

  setOnline(isOnline: boolean): void {
    this.orchestrator.setOnline(isOnline);
  }

  triggerSync(): void {
    this.orchestrator.triggerSync();
  }

  private emitExternalChange(changes: ConfigurationChange[]): void {
    for (const listener of this.externalChangeListeners) {
      listener(changes);
    }
  }

  private cloneSnapshot(snapshot: ConfigurationLayerData): ConfigurationLayerData {
    return {
      entries: { ...snapshot.entries },
      revision: snapshot.revision,
      lastSyncedAt: snapshot.lastSyncedAt,
    };
  }
}

export function createSyncableStorageProviderAdapter(
  options: SyncableStorageProviderAdapterOptions,
): SyncableStorageProviderAdapter {
  return new SyncableStorageProviderAdapter(options);
}
