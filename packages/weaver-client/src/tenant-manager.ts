import type { ConfigDelta, ConfigSnapshot } from "./types.js";
import type { WeaverTransport } from "./transport.js";

export type TenantMode = "lazy" | "eager" | "hot";

export interface TenantManagerOptions {
  mode: TenantMode;
  transport: WeaverTransport;
  serviceId: string;
  initialSnapshot: ConfigSnapshot;
}

export interface TenantManager {
  getTenantState(tenantId: string): Record<string, unknown> | undefined;
  warmTenant(tenantId: string): Promise<void>;
  applyDelta(delta: ConfigDelta, tenantId?: string): void;
  readonly loadedTenants: ReadonlySet<string>;
}

export function createTenantManager(options: TenantManagerOptions): TenantManager {
  const { mode, transport, serviceId, initialSnapshot } = options;
  const tenantStates = new Map<string, Record<string, unknown>>();
  const loadedTenants = new Set<string>();

  if (mode === "eager" || mode === "hot") {
    for (const [tenantId, state] of Object.entries(initialSnapshot.tenants)) {
      tenantStates.set(tenantId, { ...state });
      loadedTenants.add(tenantId);
    }
  }

  return {
    getTenantState(tenantId: string): Record<string, unknown> | undefined {
      return tenantStates.get(tenantId);
    },

    async warmTenant(tenantId: string): Promise<void> {
      if (loadedTenants.has(tenantId)) return;
      const snapshot = await transport.resolveAll(serviceId, { tenantId });
      const tenantData = snapshot.tenants[tenantId];
      if (tenantData) {
        tenantStates.set(tenantId, { ...tenantData });
      } else {
        tenantStates.set(tenantId, {});
      }
      loadedTenants.add(tenantId);
    },

    applyDelta(delta: ConfigDelta, tenantId?: string): void {
      if (!tenantId) return;
      const state = tenantStates.get(tenantId);
      if (!state) return;
      if (delta.action === "set") {
        state[delta.key] = delta.value;
      } else {
        delete state[delta.key];
      }
    },

    get loadedTenants(): ReadonlySet<string> {
      return loadedTenants;
    },
  };
}
