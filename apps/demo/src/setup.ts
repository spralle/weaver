import { createConfigurationService } from "@weaver/config-runtime";
import { createInMemoryStorageProvider } from "@weaver/storage-provider-memory";
import { createLocalStorageProvider } from "@weaver/storage-provider-local-storage";
import { createStaticJsonStorageProvider } from "@weaver/storage-provider-static-json";
import { createOverrideSessionProvider } from "@weaver/config-sessions";
import { defineWeaver, Layers } from "@weaver/config-types";
import {
  APP_DEFAULTS,
  CORE_DEFAULTS,
  COUNTRY_GB_DEFAULTS,
  COUNTRY_NL_DEFAULTS,
  LOCATION_FRCQF_DEFAULTS,
  LOCATION_GBDVR_DEFAULTS,
  LOCATION_NLEUR_DEFAULTS,
} from "./seed-data.js";

/** All registered provider layer names, in rank order (lowest to highest). */
export const ALL_PROVIDER_LAYERS: readonly string[] = [
  "core",
  "app",
  "tenant",
  "country:GB",
  "country:NL",
  "location:GBDVR",
  "location:FRCQF",
  "location:NLEUR",
  "user",
  "session",
];

export async function initService() {
  const weaverConfig = defineWeaver([
    Layers.Static("core"),
    Layers.Static("app"),
    Layers.Dynamic("tenant"),
    Layers.Personal("user"),
    Layers.Ephemeral("session"),
  ] as const);

  const coreProvider = createStaticJsonStorageProvider({
    id: "core-defaults",
    layer: "core",
    data: CORE_DEFAULTS,
  });

  const appProvider = createStaticJsonStorageProvider({
    id: "app-defaults",
    layer: "app",
    data: APP_DEFAULTS,
  });

  const tenantProvider = createInMemoryStorageProvider({
    id: "tenant-config",
    layer: "tenant",
  });

  const userProvider = createLocalStorageProvider({
    id: "user-prefs",
    layer: "user",
    storageKey: "weaver-demo-user",
  });

  // Country scope providers (no FR!)
  const countryGB = createInMemoryStorageProvider({
    id: "country-gb",
    layer: "country:GB",
    initialEntries: COUNTRY_GB_DEFAULTS,
  });

  const countryNL = createInMemoryStorageProvider({
    id: "country-nl",
    layer: "country:NL",
    initialEntries: COUNTRY_NL_DEFAULTS,
  });

  // Location scope providers
  const locationGBDVR = createInMemoryStorageProvider({
    id: "location-gbdvr",
    layer: "location:GBDVR",
    initialEntries: LOCATION_GBDVR_DEFAULTS,
  });

  const locationFRCQF = createInMemoryStorageProvider({
    id: "location-frcqf",
    layer: "location:FRCQF",
    initialEntries: LOCATION_FRCQF_DEFAULTS,
  });

  const locationNLEUR = createInMemoryStorageProvider({
    id: "location-nleur",
    layer: "location:NLEUR",
    initialEntries: LOCATION_NLEUR_DEFAULTS,
  });

  const session = createOverrideSessionProvider({
    layer: "session",
    defaultDurationMs: 5 * 60 * 1000,
  });

  const service = await createConfigurationService({
    providers: [
      coreProvider,
      appProvider,
      tenantProvider,
      countryGB,
      countryNL,
      locationGBDVR,
      locationFRCQF,
      locationNLEUR,
      userProvider,
    ],
    weaverConfig,
    session,
  });

  return { service, session, weaverConfig };
}
