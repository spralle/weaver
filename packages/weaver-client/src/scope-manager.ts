import type { ScopeInstance } from "@weaver/config-types";
import type { WeaverTransport } from "./transport.js";
import type { ConfigDelta, ConfigSnapshot } from "./types.js";

export type ScopeLoadingMode = "lazy" | "eager" | "hot";

export interface ScopeLoaderOptions {
  mode: ScopeLoadingMode;
  transport: WeaverTransport;
  initialSnapshot: ConfigSnapshot;
}

export interface ScopeLoader {
  getScopeState(
    scopePath: ScopeInstance[],
  ): Record<string, unknown> | undefined;
  preloadScope(scopePath: ScopeInstance[]): Promise<void>;
  applyDelta(delta: ConfigDelta, scopePath?: ScopeInstance[]): void;
  loadedScopes(): string[];
}

function buildScopeKey(scopePath: ScopeInstance[]): string {
  return scopePath.map((s) => `${s.scopeId}:${s.value}`).join("/");
}

export function createScopeLoader(options: ScopeLoaderOptions): ScopeLoader {
  const { mode, transport, initialSnapshot } = options;
  const scopeStates = new Map<string, Record<string, unknown>>();
  const loaded = new Set<string>();

  if (mode === "eager" || mode === "hot") {
    for (const [scopeKey, state] of Object.entries(initialSnapshot.scopes)) {
      scopeStates.set(scopeKey, { ...state });
      loaded.add(scopeKey);
    }
  }

  return {
    getScopeState(
      scopePath: ScopeInstance[],
    ): Record<string, unknown> | undefined {
      const key = buildScopeKey(scopePath);
      return scopeStates.get(key);
    },

    async preloadScope(scopePath: ScopeInstance[]): Promise<void> {
      const key = buildScopeKey(scopePath);
      if (loaded.has(key)) return;
      const snapshot = await transport.resolveAll({ scopePath });
      const scopeData = snapshot.scopes[key];
      if (scopeData) {
        scopeStates.set(key, { ...scopeData });
      } else {
        scopeStates.set(key, {});
      }
      loaded.add(key);
    },

    applyDelta(delta: ConfigDelta, scopePath?: ScopeInstance[]): void {
      if (!scopePath) return;
      const key = buildScopeKey(scopePath);
      const state = scopeStates.get(key);
      if (!state) return;
      if (delta.action === "set") {
        state[delta.key] = delta.value;
      } else {
        delete state[delta.key];
      }
    },

    loadedScopes(): string[] {
      return [...loaded];
    },
  };
}
