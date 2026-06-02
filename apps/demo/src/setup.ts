import {
  createWeaverClient,
  createLocalTransport,
} from "@weaver-conf/weaver-client";
import type { WeaverClient } from "@weaver-conf/weaver-client";
import { createOverrideSessionProvider } from "@weaver-conf/config-sessions";
import type { OverrideSessionController } from "@weaver-conf/config-sessions";
import { defineWeaver, Layers } from "@weaver-conf/config-types";
import type { WeaverConfig } from "@weaver-conf/config-types";
import { SEED_SNAPSHOT } from "./seed-data";

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

export async function initService(): Promise<{
  client: WeaverClient;
  session: OverrideSessionController;
  weaverConfig: WeaverConfig;
}> {
  const weaverConfig = defineWeaver([
    Layers.Static("core"),
    Layers.Static("app"),
    Layers.Dynamic("tenant"),
    Layers.Personal("user"),
    Layers.Ephemeral("session"),
  ] as const);

  const session = createOverrideSessionProvider({
    layer: "session",
    defaultDurationMs: 5 * 60 * 1000,
  });

  const transport = createLocalTransport({ snapshot: SEED_SNAPSHOT });

  const client = await createWeaverClient({ transport });

  return { client, session, weaverConfig };
}
