import type { ConfigurationService, WeaverConfig } from "@weaver/config-types";
import { buildScopePath, findLocation } from "../locations.js";
import { getSchemaForKey } from "../schemas.js";
import { ALL_KEYS } from "../seed-data.js";
import {
  getSelectedKey,
  getSelectedLocation,
  onSelectedKeyChange,
  onSelectedLocationChange,
  setSelectedKey,
} from "../state.js";

const LAYER_TYPE_COLORS: Record<string, string> = {
  static: "var(--color-static)",
  dynamic: "var(--color-dynamic)",
  personal: "var(--color-personal)",
  ephemeral: "var(--color-ephemeral)",
  scope: "var(--color-scope)",
};

const POLICY_CLASSES: Record<string, string> = {
  "direct-allowed": "policy-direct",
  "staging-gate": "policy-staging",
  "full-pipeline": "policy-pipeline",
  "emergency-override": "policy-emergency",
};

export function renderConfigBrowser(
  container: HTMLElement,
  service: ConfigurationService,
  weaverConfig: WeaverConfig,
): void {
  container.innerHTML = `<h2>Config Browser</h2><div class="key-list"></div>`;
  const list = container.querySelector(".key-list")!;

  function render(): void {
    const selected = getSelectedKey();
    list.innerHTML = "";

    for (const key of ALL_KEYS) {
      const row = buildRow(key, selected, service, weaverConfig);
      row.addEventListener("click", () => setSelectedKey(key));
      list.appendChild(row);
    }
  }

  render();
  onSelectedKeyChange(() => render());
  onSelectedLocationChange(() => render());
  for (const key of ALL_KEYS) {
    service.onChange(key, () => render());
  }
}

function buildRow(
  key: string,
  selected: string | null,
  service: ConfigurationService,
  weaverConfig: WeaverConfig,
): HTMLDivElement {
  const locationCode = getSelectedLocation();
  const loc = locationCode ? findLocation(locationCode) : null;
  const baseValue = service.get(key);
  const value = loc ? service.getForScope(key, buildScopePath(loc)) : baseValue;
  const inspection = service.inspect(key);
  const row = document.createElement("div");
  row.className = `key-row${key === selected ? " selected" : ""}`;

  // If scoped value differs from base, location layer is the winner
  const isLocationWinner = loc !== null && value !== baseValue;
  const borderColor = isLocationWinner
    ? "var(--color-scope)"
    : getLayerColor(inspection.effectiveLayer, weaverConfig);
  if (borderColor) {
    row.style.borderLeft = `3px solid ${borderColor}`;
  }

  const schema = getSchemaForKey(key);
  const badges = buildBadges(schema);

  row.innerHTML = `
    <span class="key-name">${key}</span>
    <span class="key-value">${formatValue(value)}${badges}</span>
  `;
  return row;
}

function getLayerColor(
  layerName: string | undefined,
  weaverConfig: WeaverConfig,
): string | null {
  if (!layerName) return null;
  const layer = weaverConfig.getLayer(layerName);
  if (!layer) return null;
  return LAYER_TYPE_COLORS[layer.type.id] ?? null;
}

function buildBadges(schema: ReturnType<typeof getSchemaForKey>): string {
  if (!schema) return "";
  let html = "";
  if (schema.maxOverrideLayer) {
    html += ` <span class="ceiling-badge">🔒</span>`;
  }
  const policy = schema.changePolicy ?? "direct-allowed";
  const cls = POLICY_CLASSES[policy] ?? "";
  html += ` <span class="key-policy-badge ${cls}">${policyLabel(policy)}</span>`;
  return html;
}

function policyLabel(policy: string): string {
  switch (policy) {
    case "direct-allowed":
      return "direct";
    case "staging-gate":
      return "staging";
    case "full-pipeline":
      return "pipeline";
    case "emergency-override":
      return "emergency";
    default:
      return policy;
  }
}

function formatValue(value: unknown): string {
  if (value === undefined) return "<em>undefined</em>";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}
