import type { ConfigurationPropertySchema } from "@weaver-conf/config-types";

import type { ClientSchemaRegistry } from "./schema-registry";
import type { WeaverClientPersistence } from "./persistence";
import type { StalenessMonitor } from "./staleness";
import type { WeaverTransport } from "./transport";
import type { ConfigSnapshot } from "./types";

export interface BootResult {
  baseState: Record<string, unknown>;
  revision: string;
  connected: boolean;
  lastSyncedAt: Date | null;
  freshSnapshot: ConfigSnapshot | null;
}

export async function bootClient(options: {
  namespace: string | undefined;
  transport: WeaverTransport;
  persistence: WeaverClientPersistence | undefined;
  offlineBoot: boolean;
  registry: ClientSchemaRegistry | undefined;
  stalenessMonitor: StalenessMonitor;
}): Promise<BootResult> {
  const { namespace, transport, persistence, offlineBoot, registry, stalenessMonitor } = options;

  let baseState: Record<string, unknown> = {};
  let revision = "";
  let connected = false;
  let lastSyncedAt: Date | null = null;

  // Try loading from cache first
  if (persistence) {
    const cached = await persistence.load(namespace ?? "default");
    if (cached) {
      baseState = { ...cached.entries };
      revision = cached.revision;
    }
  }

  // Fetch fresh snapshot from transport
  let freshSnapshot: ConfigSnapshot | null = null;
  try {
    freshSnapshot = await transport.resolveAll();
    baseState = { ...freshSnapshot.entries };
    revision = freshSnapshot.revision;
    lastSyncedAt = new Date();
    connected = true;
    stalenessMonitor.recordSync();

    if (persistence) {
      await persistence.save(namespace ?? "default", freshSnapshot);
    }

    // Load schemas if registry enabled and transport supports it
    if (registry && "fetchSchemas" in transport) {
      try {
        // SAFETY: duck-typing transport for optional fetchSchemas capability
        const fetch = (transport as { fetchSchemas: () => Promise<Record<string, unknown>> }).fetchSchemas;
        // SAFETY: fetchSchemas returns schema registry structure
        registry.load(await fetch() as Record<string, ConfigurationPropertySchema>);
      } catch { /* Schema loading is optional */ }
    }
  } catch (error) {
    if (offlineBoot && revision) {
      // We have cached data — degrade gracefully
      connected = false;
    } else {
      stalenessMonitor.dispose();
      throw error;
    }
  }

  return { baseState, revision, connected, lastSyncedAt, freshSnapshot };
}
