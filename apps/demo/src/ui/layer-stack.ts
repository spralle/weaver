import type { WeaverConfig } from "@weaver/config-types";

const TYPE_COLORS: Record<string, string> = {
  static: "var(--color-static)",
  dynamic: "var(--color-dynamic)",
  personal: "var(--color-personal)",
  ephemeral: "var(--color-ephemeral)",
};

export function renderLayerStack(
  container: HTMLElement,
  weaverConfig: WeaverConfig,
): void {
  container.innerHTML = `<h2>Layer Stack</h2><div class="layer-list"></div>`;
  const list = container.querySelector(".layer-list")!;

  // Render bottom-to-top (highest priority at top)
  const layers = [...weaverConfig.layers].reverse();

  for (const layer of layers) {
    const typeId = layer.type.id;
    const color = TYPE_COLORS[typeId] ?? "var(--color-text)";
    const writable = !layer.type.persistent || typeId === "dynamic"
      || typeId === "personal" || typeId === "ephemeral";

    const el = document.createElement("div");
    el.className = "layer-card";
    el.style.borderLeftColor = color;
    el.innerHTML = `
      <div class="layer-name" style="color:${color}">${layer.name}</div>
      <div class="layer-meta">
        <span class="layer-type">${typeId}</span>
        <span class="layer-badge ${writable ? "writable" : "readonly"}">
          ${writable ? "writable" : "read-only"}
        </span>
      </div>
    `;
    list.appendChild(el);
  }
}
