import { initService } from "./setup.js";
import "./schemas.js";
import { ALL_KEYS } from "./seed-data.js";
import { addLogEntry } from "./state.js";
import { renderActivityLog } from "./ui/activity-log.js";
import { renderConfigBrowser } from "./ui/config-browser.js";
import { renderEditor } from "./ui/editor.js";
import { renderInspector } from "./ui/inspector.js";
import { renderLayerStack } from "./ui/layer-stack.js";
import { renderLocationSelector } from "./ui/location-selector.js";
import { renderSessionPanel } from "./ui/session-panel.js";

async function main(): Promise<void> {
  const { service, session, weaverConfig } = await initService();

  // Subscribe to all key changes for activity log
  for (const key of ALL_KEYS) {
    service.onChange(key, (newVal: unknown) => {
      addLogEntry(`${key} changed to ${JSON.stringify(newVal)}`);
    });
  }

  // Mount UI panels
  renderLayerStack(document.getElementById("layer-stack")!, weaverConfig);
  renderLocationSelector(document.getElementById("location-selector")!);
  renderConfigBrowser(
    document.getElementById("config-browser")!,
    service,
    weaverConfig,
  );
  renderInspector(document.getElementById("inspector")!, service, weaverConfig);
  renderEditor(
    document.getElementById("editor")!,
    service,
    session,
    weaverConfig,
  );
  renderSessionPanel(
    document.getElementById("session-panel")!,
    session,
    service,
  );
  renderActivityLog(document.getElementById("activity-log")!);

  addLogEntry("Weaver demo initialized");
}

main().catch(console.error);
