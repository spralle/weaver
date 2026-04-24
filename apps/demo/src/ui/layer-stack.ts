import type { WeaverConfig } from "@weaver/config-types";
import { getSelectedLocation, onSelectedLocationChange } from "../state.js";
import { findLocation, COUNTRY_CODES_WITH_PROVIDERS } from "../locations.js";

const TYPE_COLORS: Record<string, string> = {
  static: "var(--color-static)",
  dynamic: "var(--color-dynamic)",
  personal: "var(--color-personal)",
  ephemeral: "var(--color-ephemeral)",
  scope: "var(--color-scope)",
};

export function renderLayerStack(
  container: HTMLElement,
  weaverConfig: WeaverConfig,
): void {
  container.innerHTML = `<h2>Layer Stack</h2><div class="layer-list"></div>`;
  const list = container.querySelector(".layer-list")!;

  function render(): void {
    list.innerHTML = "";
    const layers = [...weaverConfig.layers].reverse();
    const locationCode = getSelectedLocation();
    const loc = locationCode ? findLocation(locationCode) : null;

    for (const layer of layers) {
      list.appendChild(buildLayerCard(layer.name, layer.type.id));

      // Insert scope layers after user (reversed: user comes before tenant)
      if (layer.name === "user" && loc) {
        list.appendChild(buildScopeCard(`location:${loc.code}`));
        if (COUNTRY_CODES_WITH_PROVIDERS.has(loc.countryCode)) {
          list.appendChild(buildScopeCard(`country:${loc.countryCode}`));
        }
      }
    }
  }

  render();
  onSelectedLocationChange(() => render());
}

function buildLayerCard(name: string, typeId: string): HTMLDivElement {
  const color = TYPE_COLORS[typeId] ?? "var(--color-text)";
  const writable = typeId !== "static";

  const el = document.createElement("div");
  el.className = "layer-card";
  el.style.borderLeftColor = color;
  el.innerHTML = `
    <div class="layer-name" style="color:${color}">${name}</div>
    <div class="layer-meta">
      <span class="layer-type">${typeId}</span>
      <span class="layer-badge ${writable ? "writable" : "readonly"}">
        ${writable ? "writable" : "read-only"}
      </span>
    </div>
  `;
  return el;
}

function buildScopeCard(name: string): HTMLDivElement {
  const color = "var(--color-scope)";
  const el = document.createElement("div");
  el.className = "layer-card layer-card-scope";
  el.style.borderLeftColor = color;
  el.innerHTML = `
    <div class="layer-name" style="color:${color}">▸ ${name}</div>
    <div class="layer-meta">
      <span class="layer-type">scope</span>
      <span class="layer-badge writable">writable</span>
    </div>
  `;
  return el;
}
