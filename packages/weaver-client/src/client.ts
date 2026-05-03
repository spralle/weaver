import type { ConfigDelta, ConfigSnapshot, GetOptions, Unsubscribe } from "./types.js";
import type { WeaverTransport } from "./transport.js";
import type { WeaverClientPersistence } from "./persistence.js";
import { createTenantManager, type TenantMode } from "./tenant-manager.js";

export interface WeaverClientOptions {
  serviceId: string;
  transport: WeaverTransport;
  tenantMode?: TenantMode;
  persistence?: WeaverClientPersistence;
}

export interface WeaverClient {
  get(key: string, options?: GetOptions): unknown;
  getNamespace(prefix: string, options?: GetOptions): Record<string, unknown>;
  onChange(pattern: string, handler: (changes: ConfigDelta[]) => void): Unsubscribe;
  onRestartRequired(handler: () => void): Unsubscribe;
  warmTenant(tenantId: string): Promise<void>;
  readonly revision: string;
  readonly connected: boolean;
  close(): Promise<void>;
}

function matchGlob(pattern: string, key: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]*") + "$",
  );
  return regex.test(key);
}

export async function createWeaverClient(options: WeaverClientOptions): Promise<WeaverClient> {
  const { serviceId, transport, tenantMode = "lazy", persistence } = options;

  let platformState: Record<string, unknown> = {};
  let revision = "";
  let connected = false;

  // Try loading from cache first
  let snapshot: ConfigSnapshot | null = null;
  if (persistence) {
    snapshot = await persistence.load(serviceId);
    if (snapshot) {
      platformState = { ...snapshot.platform };
      revision = snapshot.revision;
    }
  }

  // Fetch fresh snapshot from transport
  const freshSnapshot = await transport.resolveAll(serviceId);
  platformState = { ...freshSnapshot.platform };
  revision = freshSnapshot.revision;
  snapshot = freshSnapshot;

  if (persistence) {
    await persistence.save(serviceId, freshSnapshot);
  }

  const tenantManager = createTenantManager({
    mode: tenantMode,
    transport,
    serviceId,
    initialSnapshot: freshSnapshot,
  });

  const changeListeners = new Map<string, Set<(changes: ConfigDelta[]) => void>>();
  const restartListeners = new Set<() => void>();

  // Subscribe to deltas
  const unsubTransport = transport.subscribe(serviceId, (delta: ConfigDelta) => {
    // Apply to platform or tenant state
    if (delta.layer === "platform" || !delta.layer) {
      if (delta.action === "set") {
        platformState[delta.key] = delta.value;
      } else {
        delete platformState[delta.key];
      }
    } else {
      tenantManager.applyDelta(delta, delta.layer);
    }

    // Fire matching onChange listeners
    for (const [pattern, handlers] of changeListeners) {
      if (matchGlob(pattern, delta.key)) {
        for (const handler of handlers) {
          handler([delta]);
        }
      }
    }
  });

  connected = true;

  const client: WeaverClient = {
    get(key: string, opts?: GetOptions): unknown {
      if (opts?.tenantId) {
        const tenantState = tenantManager.getTenantState(opts.tenantId);
        return tenantState?.[key];
      }
      return platformState[key];
    },

    getNamespace(prefix: string, opts?: GetOptions): Record<string, unknown> {
      const source = opts?.tenantId
        ? tenantManager.getTenantState(opts.tenantId) ?? {}
        : platformState;
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(source)) {
        if (key.startsWith(prefix)) {
          result[key] = value;
        }
      }
      return result;
    },

    onChange(pattern: string, handler: (changes: ConfigDelta[]) => void): Unsubscribe {
      if (!changeListeners.has(pattern)) {
        changeListeners.set(pattern, new Set());
      }
      changeListeners.get(pattern)!.add(handler);
      return () => {
        changeListeners.get(pattern)?.delete(handler);
      };
    },

    onRestartRequired(handler: () => void): Unsubscribe {
      restartListeners.add(handler);
      return () => {
        restartListeners.delete(handler);
      };
    },

    async warmTenant(tenantId: string): Promise<void> {
      await tenantManager.warmTenant(tenantId);
    },

    get revision(): string {
      return revision;
    },

    get connected(): boolean {
      return connected;
    },

    async close(): Promise<void> {
      unsubTransport();
      connected = false;
      await transport.close();
    },
  };

  return client;
}
