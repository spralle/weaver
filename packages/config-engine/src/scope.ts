// Scope chain builder for dynamic tenant scope hierarchies

import type { ScopeInstance, TenantScopeHierarchy } from "@weaver/config-types";

export interface ScopeChainEntry {
  scopeId: string;
  value: string;
}

export type BuildScopeChainResult =
  | { success: true; chain: ScopeChainEntry[] }
  | { success: false; error: string };

/**
 * Validates a scope path against a tenant's scope hierarchy and returns
 * an ordered scope chain.
 *
 * Rules:
 * - Empty scopePath → empty chain (success)
 * - Each scope instance must have a matching ScopeDefinition in hierarchy
 * - Parent-child ordering: if scope B has parentScopeId = A, then A must
 *   come before B in scopePath
 * - Unknown scopeId → error
 */
export function buildScopeChain(
  hierarchy: TenantScopeHierarchy,
  scopePath: ScopeInstance[],
): BuildScopeChainResult {
  if (scopePath.length === 0) {
    return { success: true, chain: [] };
  }

  const definitionMap = new Map(hierarchy.scopes.map((s) => [s.id, s]));

  const chain: ScopeChainEntry[] = [];
  const seenScopeIds = new Set<string>();

  for (const instance of scopePath) {
    const definition = definitionMap.get(instance.scopeId);

    if (!definition) {
      return {
        success: false,
        error: `Unknown scope ID "${instance.scopeId}" not found in hierarchy`,
      };
    }

    // Validate parent-child ordering
    if (definition.parentScopeId !== undefined) {
      if (!seenScopeIds.has(definition.parentScopeId)) {
        return {
          success: false,
          error: `Scope "${instance.scopeId}" requires parent scope "${definition.parentScopeId}" to appear earlier in the path`,
        };
      }
    }

    seenScopeIds.add(instance.scopeId);
    chain.push({ scopeId: instance.scopeId, value: instance.value });
  }

  return { success: true, chain };
}
