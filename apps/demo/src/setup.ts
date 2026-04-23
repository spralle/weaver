import { defineWeaver, Layers } from "@weaver/config-types";
import {
  StaticJsonStorageProvider,
  InMemoryStorageProvider,
  LocalStorageProvider,
  createConfigurationService,
} from "@weaver/config-providers";
import { createOverrideSessionProvider } from "@weaver/config-sessions";
import { CORE_DEFAULTS, APP_DEFAULTS } from "./seed-data.js";

export async function initService() {
  const weaverConfig = defineWeaver([
    Layers.Static("core"),
    Layers.Static("app"),
    Layers.Dynamic("tenant"),
    Layers.Personal("user"),
    Layers.Ephemeral("session"),
  ] as const);

  const coreProvider = new StaticJsonStorageProvider({
    id: "core-defaults",
    layer: "core",
    data: CORE_DEFAULTS,
  });

  const appProvider = new StaticJsonStorageProvider({
    id: "app-defaults",
    layer: "app",
    data: APP_DEFAULTS,
  });

  const tenantProvider = new InMemoryStorageProvider({
    id: "tenant-config",
    layer: "tenant",
  });

  const userProvider = new LocalStorageProvider({
    id: "user-prefs",
    layer: "user",
    storageKey: "weaver-demo-user",
  });

  const session = createOverrideSessionProvider({
    layer: "session",
    defaultDurationMs: 5 * 60 * 1000,
  });

  const service = await createConfigurationService({
    providers: [coreProvider, appProvider, tenantProvider, userProvider],
    weaverConfig,
    session,
  });

  return { service, session, weaverConfig };
}
