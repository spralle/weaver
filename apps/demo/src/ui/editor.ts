import type { ConfigurationService, WeaverConfig } from "@weaver/config-types";
import type { OverrideSessionController } from "@weaver/config-sessions";
import { evaluateChangePolicy } from "@weaver/config-policy";
import { getSelectedKey, onSelectedKeyChange, addLogEntry, isSessionActive, onSessionActiveChange } from "../state.js";
import { getSelectedLocation, onSelectedLocationChange } from "../state.js";
import { getSchemaForKey } from "../schemas.js";
import { findLocation, COUNTRY_CODES_WITH_PROVIDERS } from "../locations.js";

const BASE_WRITABLE_LAYERS = ["tenant", "user", "session"] as const;

function getWritableLayers(): string[] {
  const locationCode = getSelectedLocation();
  if (!locationCode) return [...BASE_WRITABLE_LAYERS];
  const loc = findLocation(locationCode);
  const layers = ["tenant"];
  if (loc && COUNTRY_CODES_WITH_PROVIDERS.has(loc.countryCode)) {
    layers.push(`country:${loc.countryCode}`);
  }
  layers.push(`location:${locationCode}`);
  layers.push("user", "session");
  return layers;
}

export function renderEditor(
  container: HTMLElement,
  service: ConfigurationService,
  session: OverrideSessionController,
  weaverConfig: WeaverConfig,
): void {
  container.innerHTML = `<h2>Value Editor</h2><div class="editor-body"></div>`;
  const body = container.querySelector(".editor-body")!;

  function render(): void {
    const key = getSelectedKey();
    if (key === null) {
      body.innerHTML = `<p class="placeholder">Select a key to edit</p>`;
      return;
    }

    const currentValue = service.get(key);
    const schema = getSchemaForKey(key);
    let html = `<h3>${key}</h3>`;

    for (const layer of getWritableLayers()) {
      html += buildLayerSection(layer, key, currentValue, service, schema, weaverConfig);
    }

    html += `<div class="policy-feedback" id="policy-feedback"></div>`;
    body.innerHTML = html;
    bindEvents(body, key, service, session, weaverConfig);
  }

  render();
  onSelectedKeyChange(() => render());
  onSessionActiveChange(() => render());
  onSelectedLocationChange(() => render());

  let cleanupOnChange: (() => void) | null = null;
  onSelectedKeyChange((key) => {
    cleanupOnChange?.();
    if (key !== null) {
      cleanupOnChange = service.onChange(key, () => render());
    }
  });
}

function buildLayerSection(
  layer: string,
  key: string,
  currentValue: unknown,
  service: ConfigurationService,
  schema: ReturnType<typeof getSchemaForKey>,
  weaverConfig: WeaverConfig,
): string {
  const layerValue = service.getAtLayer(layer, key);
  const blocked = isCeilingBlocked(layer, schema, weaverConfig);

  const cls = blocked ? "editor-layer ceiling-blocked" : "editor-layer";
  let html = `<div class="${cls}" data-layer="${layer}">`;
  html += `<label>${layer}</label>`;

  if (blocked) {
    const ceiling = schema?.maxOverrideLayer ?? "?";
    html += `<div class="ceiling-msg">🔒 Ceiling: max override at <strong>${ceiling}</strong></div>`;
  } else {
    html += `<div class="editor-controls">`;
    html += buildInput(key, layer, currentValue, layerValue);
    html += `<button class="btn-set" data-layer="${layer}">Set</button>`;
    html += `<button class="btn-remove" data-layer="${layer}" ${layerValue === undefined ? "disabled" : ""}>Remove</button>`;
    html += `</div>`;
    html += `<span class="current-layer-val">${layerValue !== undefined ? JSON.stringify(layerValue) : "—"}</span>`;
  }

  html += `</div>`;
  return html;
}

function isCeilingBlocked(
  layer: string,
  schema: ReturnType<typeof getSchemaForKey>,
  weaverConfig: WeaverConfig,
): boolean {
  if (!schema?.maxOverrideLayer) return false;
  if (layer === "session" && isSessionActive()) return false;
  // Scope layers (country:*, location:*) sit between tenant (rank 2) and user (rank 3)
  const SCOPE_LAYER_RANK = 2.5;
  const isScopeLayer = layer.startsWith("location:") || layer.startsWith("country:");
  const layerRank = isScopeLayer
    ? SCOPE_LAYER_RANK
    : weaverConfig.getRank(layer);
  const ceilingRank = weaverConfig.getRank(schema.maxOverrideLayer);
  if (layerRank < 0 || ceilingRank < 0) return false;
  return layerRank > ceilingRank;
}

function buildInput(
  _key: string,
  layer: string,
  currentValue: unknown,
  layerValue: unknown,
): string {
  const attr = `data-input-layer="${layer}"`;
  const hasOwn = layerValue !== undefined;

  if (typeof currentValue === "boolean") {
    const inherit = hasOwn ? "" : `<option value="" selected>— inherit —</option>`;
    const tSel = hasOwn && layerValue === true ? " selected" : "";
    const fSel = hasOwn && layerValue === false ? " selected" : "";
    return `<select ${attr}>${inherit}<option value="true"${tSel}>true</option><option value="false"${fSel}>false</option></select>`;
  }
  if (typeof currentValue === "number") {
    const val = hasOwn ? ` value="${layerValue}"` : "";
    const ph = hasOwn ? "" : ` placeholder="${currentValue}"`;
    return `<input ${attr} type="number"${val}${ph} />`;
  }
  const val = hasOwn ? ` value="${layerValue}"` : "";
  const ph = hasOwn ? "" : ` placeholder="${currentValue ?? ""}"`;
  return `<input ${attr} type="text"${val}${ph} />`;
}

function parseInput(el: HTMLInputElement | HTMLSelectElement, currentValue: unknown): unknown {
  const raw = el.value;
  if (raw === "") return currentValue;
  if (typeof currentValue === "boolean") return raw === "true";
  if (typeof currentValue === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

function showFeedback(body: Element, message: string, level: "warning" | "error"): void {
  const el = body.querySelector("#policy-feedback");
  if (!el) return;
  el.className = `policy-feedback ${level}`;
  el.textContent = message;
}

function clearFeedback(body: Element): void {
  const el = body.querySelector("#policy-feedback");
  if (!el) return;
  el.className = "policy-feedback";
  el.textContent = "";
}

function handleSet(
  body: Element,
  key: string,
  layer: string,
  service: ConfigurationService,
  session: OverrideSessionController,
): void {
  const input = body.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-input-layer="${layer}"]`);
  if (!input) return;

  const schema = getSchemaForKey(key);
  const value = parseInput(input, service.get(key));

  if (schema) {
    const ctx = {
      userId: "demo-user",
      tenantId: "demo-tenant",
      roles: ["admin"] as readonly string[],
      sessionMode: isSessionActive() ? ("emergency-override" as const) : undefined,
      overrideReason: session.getSession()?.reason,
    };
    const decision = evaluateChangePolicy(schema, ctx, layer, () => true);

    if (decision.outcome === "requires-promotion") {
      showFeedback(body, decision.message, "warning");
      return;
    }
    if (decision.outcome === "requires-emergency-auth") {
      showFeedback(body, "Activate an override session first", "error");
      return;
    }
    if (decision.outcome === "denied") {
      showFeedback(body, decision.reason, "error");
      return;
    }
  }

  clearFeedback(body);
  service.set(key, value, layer);
  addLogEntry(`Set ${key} = ${JSON.stringify(value)} at [${layer}]`);
}

function bindEvents(
  body: Element,
  key: string,
  service: ConfigurationService,
  session: OverrideSessionController,
  _weaverConfig: WeaverConfig,
): void {
  for (const btn of body.querySelectorAll<HTMLButtonElement>(".btn-set")) {
    btn.addEventListener("click", () => {
      const layer = btn.dataset["layer"]!;
      handleSet(body, key, layer, service, session);
    });
  }

  for (const btn of body.querySelectorAll<HTMLButtonElement>(".btn-remove")) {
    btn.addEventListener("click", () => {
      const layer = btn.dataset["layer"]!;
      clearFeedback(body);
      service.remove(key, layer);
      addLogEntry(`Removed ${key} from [${layer}]`);
    });
  }
}
