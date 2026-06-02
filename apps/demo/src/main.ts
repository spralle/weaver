import { initService } from "./setup";
import "./schemas";
import { ALL_KEYS } from "./seed-data";
import { addLogEntry } from "./state";
import { renderActivityLog } from "./ui/activity-log";
import { renderConfigBrowser } from "./ui/config-browser";
import { renderEditor } from "./ui/editor";
import { renderInspector } from "./ui/inspector";
import { renderLayerStack } from "./ui/layer-stack";
import { renderLocationSelector } from "./ui/location-selector";
import { renderSessionPanel } from "./ui/session-panel";
import { defineNamespace } from "@weaver-conf/weaver-client";
import { z } from "zod";

async function main(): Promise<void> {
  const { client, session, weaverConfig } = await initService();

  // Subscribe to all key changes for activity log
  for (const key of ALL_KEYS) {
    client.onChange(key, (deltas) => {
      for (const delta of deltas) {
        if (delta.key === key) {
          addLogEntry(`${key} changed to ${JSON.stringify(delta.value)}`);
        }
      }
    });
  }

  // Mount UI panels
  renderLayerStack(document.getElementById("layer-stack")!, weaverConfig);
  renderLocationSelector(document.getElementById("location-selector")!);
  renderConfigBrowser(
    document.getElementById("config-browser")!,
    client,
    weaverConfig,
  );
  renderInspector(document.getElementById("inspector")!, client, weaverConfig);
  renderEditor(
    document.getElementById("editor")!,
    client,
    session,
    weaverConfig,
  );
  renderSessionPanel(
    document.getElementById("session-panel")!,
    session,
    client,
  );
  renderActivityLog(document.getElementById("activity-log")!);

  // Typed namespace showcase
  const uiConfig = defineNamespace("app.ui", {
    theme: z.enum(["light", "dark", "system"]),
    language: z.string(),
  });
  const ui = client.namespace(uiConfig);
  console.log("[weaver-demo] Typed namespace — theme:", ui.get("theme"));
  console.log("[weaver-demo] Typed namespace — language:", ui.get("language"));

  addLogEntry("Weaver demo initialized");
}

main().catch(console.error);
