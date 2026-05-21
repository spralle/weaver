import { z } from "zod";
import type { ZodType } from "zod";
import type { ScopeInstance } from "@weaver/config-types";
import { deepGet } from "@weaver/config-engine";
import type { UntypedNamespaceClient, InstanceClient } from "./namespace.js";
import type { ConfigDelta, Unsubscribe } from "./types.js";
import type { WriteOptions, WriteResult } from "./transport.js";
import { createInstanceClient } from "./instance-client.js";

/** Dependencies injected into an untyped namespace client. */
export interface UntypedNamespaceClientDeps {
  getState: (scopePath?: ScopeInstance[]) => Record<string, unknown>;
  set: (
    key: string,
    value: unknown,
    opts?: WriteOptions,
  ) => Promise<WriteResult>;
  setMany: (
    entries: Record<string, unknown>,
    opts?: WriteOptions,
  ) => Promise<WriteResult>;
  remove: (key: string, opts?: WriteOptions) => Promise<WriteResult>;
  onChange: (
    pattern: string,
    handler: (deltas: ConfigDelta[]) => void,
  ) => Unsubscribe;
}

/**
 * Creates an untyped namespace client for dynamic key access without compile-time schema.
 *
 * @param prefix - Namespace prefix (e.g., "editor.font")
 * @param deps - State access and write dependencies
 * @param scopePath - Optional scope path for scoped reads
 */
export function createUntypedNamespaceClient(
  prefix: string,
  deps: UntypedNamespaceClientDeps,
  scopePath?: ScopeInstance[],
): UntypedNamespaceClient {
  function resolveKey(key: string): string {
    return `${prefix}.${key}`;
  }

  const client: UntypedNamespaceClient = {
    get<T = unknown>(key: string, schema?: ZodType<T>): T | undefined {
      const state = deps.getState(scopePath);
      const raw = deepGet(state, resolveKey(key));
      if (raw === undefined) return undefined;
      if (schema) {
        const result = z.safeParse(schema, raw);
        return result.success ? (result.data as T) : undefined; // SAFETY: Zod parse returns the schema type
      }
      return raw as T; // SAFETY: caller asserts type via generic parameter
    },

    getOrDefault<T = unknown>(key: string, defaultValue: T): T {
      const value = client.get<T>(key);
      return value !== undefined ? value : defaultValue;
    },

    getAll(): Record<string, unknown> {
      const state = deps.getState(scopePath);
      const nsValue = deepGet(state, prefix);
      if (nsValue && typeof nsValue === "object" && !Array.isArray(nsValue)) {
        return { ...(nsValue as Record<string, unknown>) }; // SAFETY: guarded by typeof/null/array checks
      }
      return {};
    },

    async set(key, value, opts) {
      return deps.set(resolveKey(key), value, opts);
    },

    async setMany(entries, opts) {
      const prefixed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(entries)) {
        prefixed[resolveKey(k)] = v;
      }
      return deps.setMany(prefixed, opts);
    },

    async remove(key, opts) {
      return deps.remove(resolveKey(key), opts);
    },

    onChange(pattern, handler) {
      return deps.onChange(`${prefix}.${pattern}`, handler);
    },

    withScope(newScopePath) {
      const combined = [...(scopePath ?? []), ...newScopePath];
      return createUntypedNamespaceClient(prefix, deps, combined);
    },

    instance(instanceId): InstanceClient {
      return createInstanceClient(prefix, instanceId, {
        getState: () => deps.getState(scopePath) ?? {},
        set: deps.set,
        remove: deps.remove,
        onChange: deps.onChange,
      });
    },
  };

  return client;
}
