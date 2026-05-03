import type { ScopeInstance } from "@weaver/config-types";

export function parseScopeLayer(layer: string): { scopeId: string; value: string } | null {
  const colonIdx = layer.indexOf(":");
  if (colonIdx === -1) return null;
  return { scopeId: layer.slice(0, colonIdx), value: layer.slice(colonIdx + 1) };
}

export function isScopedLayer(layer: string): boolean {
  return layer.includes(":");
}

export function buildScopePathString(scopePath: ScopeInstance[]): string {
  return scopePath.map(s => `${s.scopeId}:${s.value}`).join("/");
}

export function parseScopeQuery(query: string | undefined): ScopeInstance[] | undefined {
  if (!query) return undefined;
  return query.split(",").map(part => {
    const [scopeId = "", value = ""] = part.split(":");
    return { scopeId, value };
  });
}
