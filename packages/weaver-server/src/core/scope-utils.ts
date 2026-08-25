import type { ScopeInstance } from "@weaver-conf/config-types";
import { formatScopePath } from "@weaver-conf/config-types";

const BRACKET_SCOPE_LAYER_PATTERN = /^([^[\]:]+)\[key=([^\]]+)\]$/;

export interface ParsedScopeLayer {
  scopeId: string;
  value: string;
}

export function parseScopeLayer(layer: string): ParsedScopeLayer | null {
  const bracketMatch = BRACKET_SCOPE_LAYER_PATTERN.exec(layer);
  if (bracketMatch) {
    const [, scopeId, value] = bracketMatch;
    if (!scopeId || !value) return null;
    return { scopeId, value };
  }

  const colonIdx = layer.indexOf(":");
  if (colonIdx === -1) return null;
  return {
    scopeId: layer.slice(0, colonIdx),
    value: layer.slice(colonIdx + 1),
  };
}

export function isScopedLayer(layer: string): boolean {
  return parseScopeLayer(layer) !== null;
}

export function isSameScopeLayer(left: string, right: string): boolean {
  const leftScope = parseScopeLayer(left);
  const rightScope = parseScopeLayer(right);
  if (!leftScope || !rightScope) return false;
  return (
    leftScope.scopeId === rightScope.scopeId &&
    leftScope.value === rightScope.value
  );
}

export function formatBracketScopeLayer(
  scopeId: string,
  value: string,
): string {
  return `${scopeId}[key=${value}]`;
}

export function formatColonScopeLayer(scopeId: string, value: string): string {
  return `${scopeId}:${value}`;
}

export function getEquivalentScopeLayers(layer: string): string[] {
  const parsed = parseScopeLayer(layer);
  if (!parsed) return [layer];
  return [
    formatColonScopeLayer(parsed.scopeId, parsed.value),
    formatBracketScopeLayer(parsed.scopeId, parsed.value),
  ];
}

export function normalizeScopeLayer(layer: string): string {
  const parsed = parseScopeLayer(layer);
  if (!parsed) return layer;
  return formatColonScopeLayer(parsed.scopeId, parsed.value);
}

export function buildScopePathString(scopePath: ScopeInstance[]): string {
  return formatScopePath(scopePath);
}

export function parseScopeQuery(
  query: string | undefined,
): ScopeInstance[] | undefined {
  if (!query) return undefined;
  return query.split(",").map((part) => {
    const [scopeId = "", value = ""] = part.split(":");
    return { scopeId, value };
  });
}
