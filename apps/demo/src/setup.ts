import { defineWeaver, Layers } from "@weaver/config-types";
import {
  StaticJsonStorageProvider,
  InMemoryStorageProvider,
  LocalStorageProvider,
  createConfigurationService,
} from "@weaver/config-providers";
import { createOverrideSessionProvider } from "@weaver/config-sessions";
import {
  CORE_DEFAULTS,
  APP_DEFAULTS,
  COUNTRY_GB_DEFAULTS,
  COUNTRY_NL_DEFAULTS,
  LOCATION_GBDVR_DEFAULTS,
  LOCATION_FRCQF_DEFAULTS,
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

  // Country scope providers (no FR!)
  const countryGB = new InMemoryStorageProvider({
    id: "country-gb",
    layer: "country:GB",
    initialEntries: COUNTRY_GB_DEFAULTS,
  });

  const countryNL = new InMemoryStorageProvider({
    id: "country-nl",
    layer: "country:NL",
    initialEntries: COUNTRY_NL_DEFAULTS,
  });

  // Location scope providers
  const locationGBDVR = new InMemoryStorageProvider({
    id: "location-gbdvr",
    layer: "location:GBDVR",
    initialEntries: LOCATION_GBDVR_DEFAULTS,
  });

  const locationFRCQF = new InMemoryStorageProvider({
    id: "location-frcqf",
    layer: "location:FRCQF",
    initialEntries: LOCATION_FRCQF_DEFAULTS,
  });

  const locationNLEUR = new InMemoryStorageProvider({
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
