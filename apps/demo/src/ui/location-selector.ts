import {
  getSelectedLocation,
  setSelectedLocation,
  onSelectedLocationChange,
} from "../state.js";
import {
  LOCATIONS,
  COUNTRY_CODES_WITH_PROVIDERS,
  findLocation,
} from "../locations.js";

export function renderLocationSelector(container: HTMLElement): void {
  container.innerHTML = `
    <h2>Location Scope</h2>
    <div class="location-buttons"></div>
    <div class="scope-chain"></div>
  `;
  const wrapper = container.querySelector(".location-buttons")!;
  const chainEl = container.querySelector(".scope-chain")!;

  function render(): void {
    const current = getSelectedLocation();
    wrapper.innerHTML = "";

    wrapper.appendChild(createButton("None", null, current === null));
    for (const loc of LOCATIONS) {
      const label = `${loc.flag} ${loc.label}`;
      wrapper.appendChild(createButton(label, loc.code, current === loc.code));
    }

    chainEl.innerHTML = buildChainDisplay(current);
  }

  render();
  onSelectedLocationChange(() => render());
}

function createButton(
  text: string,
  value: string | null,
  active: boolean,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = `loc-btn${active ? " active" : ""}`;
  btn.textContent = text;
  btn.addEventListener("click", () => setSelectedLocation(value));
  return btn;
}

function buildChainDisplay(locationCode: string | null): string {
  const base = ["tenant"];
  const suffix = ["user"];

  if (!locationCode) {
    return formatChain([...base, ...suffix]);
  }

  const loc = findLocation(locationCode);
  if (!loc) return formatChain([...base, ...suffix]);

  const scopeLayers: string[] = [];
  if (COUNTRY_CODES_WITH_PROVIDERS.has(loc.countryCode)) {
    scopeLayers.push(`country:${loc.countryCode}`);
  }
  scopeLayers.push(`location:${loc.code}`);

  return formatChain([...base, ...scopeLayers, ...suffix], scopeLayers);
}

function formatChain(segments: string[], highlighted: string[] = []): string {
  const set = new Set(highlighted);
  return segments
    .map((s) =>
      set.has(s) ? `<span class="scope-segment">${s}</span>` : s,
    )
    .join(" → ");
}
