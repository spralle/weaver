import type { ConfigurationService, WeaverConfig } from "@weaver/config-types";
import { onSelectedKeyChange, getSelectedKey } from "../state.js";
import { getSchemaForKey } from "../schemas.js";

const VISIBILITY_COLORS: Record<string, string> = {
  public: "#6bcb77",
  admin: "#e8a838",
  platform: "#5b9bd5",
  internal: "#e74c3c",
};

const POLICY_COLORS: Record<string, string> = {
  "direct-allowed": "#6bcb77",
  "staging-gate": "#e8d838",
  "full-pipeline": "#e8a838",
  "emergency-override": "#e74c3c",
};

export function renderInspector(
  container: HTMLElement,
  service: ConfigurationService,
  weaverConfig?: WeaverConfig,
): void {
  container.innerHTML = `<h2>Key Inspector</h2><div class="inspector-body"></div>`;
  const body = container.querySelector(".inspector-body")!;

  function render(): void {
    const key = getSelectedKey();
    if (key === null) {
      body.innerHTML = `<p class="placeholder">Select a key to inspect</p>`;
      return;
    }

    const inspection = service.inspect(key);
    const layerNames = weaverConfig
      ? [...weaverConfig.layerNames]
      : Object.keys(inspection.layerValues);

    let html = `<h3>${key}</h3>`;
    html += buildEffectiveSection(inspection);
    html += buildLayerBreakdown(layerNames, inspection);
    html += buildSchemaSection(key);
    body.innerHTML = html;
  }

  render();
  onSelectedKeyChange(() => render());

  let cleanupOnChange: (() => void) | null = null;
  onSelectedKeyChange((key) => {
    cleanupOnChange?.();
    if (key !== null) {
      cleanupOnChange = service.onChange(key, () => render());
    }
  });
}

function buildEffectiveSection(inspection: { effectiveValue: unknown; effectiveLayer: string | undefined }): string {
  return `<div class="effective-value">
    Effective: <strong>${formatValue(inspection.effectiveValue)}</strong>
    <span class="effective-layer">from <em>${inspection.effectiveLayer ?? "none"}</em></span>
  </div>`;
}

function buildLayerBreakdown(
  layerNames: string[],
  inspection: { effectiveLayer: string | undefined; layerValues: Record<string, unknown> },
): string {
  let html = `<div class="layer-breakdown">`;
  for (const layer of layerNames) {
    const value = inspection.layerValues[layer];
    const isWinner = layer === inspection.effectiveLayer;
    html += `
      <div class="layer-row${isWinner ? " winner" : ""}">
        <span class="layer-label">${layer}</span>
        <span class="layer-val">${value !== undefined ? formatValue(value) : "—"}</span>
      </div>`;
  }
  html += `</div>`;
  return html;
}

function buildSchemaSection(key: string): string {
  const schema = getSchemaForKey(key);
  if (!schema) {
    return `<div class="schema-meta"><p class="placeholder">No schema registered</p></div>`;
  }

  const visibility = schema.visibility ?? "public";
  const visColor = VISIBILITY_COLORS[visibility] ?? "#8892a4";
  const policy = schema.changePolicy ?? "direct-allowed";
  const polColor = POLICY_COLORS[policy] ?? "#8892a4";
  const ceiling = schema.maxOverrideLayer;

  return `<div class="schema-meta">
    <h4>Schema Metadata</h4>
    <dl>
      <dt>Description</dt>
      <dd>${schema.description ?? "—"}</dd>
      <dt>Visibility</dt>
      <dd><span class="schema-badge" style="background:${visColor}20;color:${visColor}">${visibility}</span></dd>
      <dt>Change Policy</dt>
      <dd><span class="schema-badge" style="background:${polColor}20;color:${polColor}">${policy}</span></dd>
      <dt>Max Override Layer</dt>
      <dd>${ceiling ? `<strong>🔒 ${ceiling}</strong>` : "—"}</dd>
    </dl>
  </div>`;
}

function formatValue(value: unknown): string {
  if (value === undefined) return "<em>undefined</em>";
  return JSON.stringify(value);
}
