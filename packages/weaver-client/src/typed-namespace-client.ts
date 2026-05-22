import { z } from "zod";
import type { ZodRawShape } from "zod";
import type { ScopeInstance } from "@weaver-conf/config-types";
import { deepGet } from "@weaver-conf/config-engine";
import type {
  TypedNamespaceClient,
  TypedInstanceClient,
  NamespaceDefinition,
} from "./namespace";
import type { ConfigDelta, Unsubscribe } from "./types";
import type { WriteOptions, WriteResult } from "./transport";

/** Dependencies injected into a typed namespace client. */
export interface NamespaceClientDeps {
  getState: (scopePath?: ScopeInstance[]) => Record<string, unknown>;
  set: (key: string, value: unknown, opts?: WriteOptions) => Promise<WriteResult>;
  remove: (key: string, opts?: WriteOptions) => Promise<WriteResult>;
  onChange: (pattern: string, handler: (deltas: ConfigDelta[]) => void) => Unsubscribe;
}

/**
 * Creates a typed namespace client that validates reads/writes against a Zod schema.
 *
 * @param definition - Namespace definition with prefix and schema shape
 * @param deps - State access and write dependencies
 * @param scopePath - Optional scope path for scoped reads
 */
export function createTypedNamespaceClient<TShape extends ZodRawShape>(
  definition: NamespaceDefinition<string, TShape>,
  deps: NamespaceClientDeps,
  scopePath?: ScopeInstance[],
): TypedNamespaceClient<TShape> {
  const { prefix, schema } = definition;

  function resolveKey(key: string): string {
    return `${prefix}.${key}`;
  }

  function getValidated<K extends keyof TShape & string>(
    key: K,
    state: Record<string, unknown>,
  ): unknown {
    const fullKey = resolveKey(key);
    const raw = deepGet(state, fullKey);
    if (raw === undefined) return undefined;
    const fieldSchema = schema.shape[key];
    if (!fieldSchema) return undefined;
    const result = z.safeParse(fieldSchema, raw);
    return result.success ? result.data : undefined;
  }

  const client: TypedNamespaceClient<TShape> = {
    get(key) {
      const state = deps.getState(scopePath);
      return getValidated(key, state) as ReturnType<TypedNamespaceClient<TShape>["get"]>; // SAFETY: getValidated returns Zod-parsed value matching the schema type
    },

    getOrDefault(key, defaultValue) {
      const value = client.get(key);
      return value !== undefined ? value : defaultValue;
    },

    getAll() {
      const state = deps.getState(scopePath);
      const nsValue = deepGet(state, prefix);
      if (!nsValue || typeof nsValue !== "object") {
        return {} as ReturnType<TypedNamespaceClient<TShape>["getAll"]>; // SAFETY: empty object satisfies partial shape
      }
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(schema.shape)) {
        const fieldSchema = schema.shape[key];
        const nsRecord = nsValue as Record<string, unknown>; // SAFETY: guarded by typeof check above
        const raw = nsRecord[key];
        if (raw !== undefined && fieldSchema) {
          const parsed = z.safeParse(fieldSchema, raw);
          if (parsed.success) result[key] = parsed.data;
        }
      }
      return result as ReturnType<TypedNamespaceClient<TShape>["getAll"]>; // SAFETY: built from Zod-validated fields
    },

    async set(key, value, opts) {
      const fullKey = resolveKey(key as string); // SAFETY: key is keyof TShape & string
      const fieldSchema = schema.shape[key as string]; // SAFETY: key is keyof TShape & string
      if (fieldSchema) {
        const parsed = z.safeParse(fieldSchema, value);
        if (!parsed.success) {
          return {
            success: false,
            error: { code: "VALIDATION_ERROR", message: parsed.error.message },
          };
        }
      }
      return deps.set(fullKey, value, opts);
    },

    onChange(keyOrHandler: unknown, handler?: unknown): Unsubscribe {
      if (typeof keyOrHandler === "function") {
        // SAFETY: caller passes (deltas: ConfigDelta[]) => void per the overload signature
        return deps.onChange(`${prefix}.*`, keyOrHandler as (deltas: ConfigDelta[]) => void);
      }
      const fullKey = resolveKey(keyOrHandler as string); // SAFETY: non-function overload passes string
      const typedHandler = handler as (value: unknown) => void; // SAFETY: second overload passes value handler
      return deps.onChange(fullKey, (deltas) => {
        for (const delta of deltas) {
          if (delta.action === "set") typedHandler(delta.value);
        }
      });
    },

    withScope(newScopePath) {
      const combinedScope = [...(scopePath ?? []), ...newScopePath];
      return createTypedNamespaceClient(definition, deps, combinedScope);
    },

    instance(instanceId) {
      return createTypedInstanceClient(definition, deps, instanceId, scopePath);
    },
  };

  return client;
}

function createTypedInstanceClient<TShape extends ZodRawShape>(
  definition: NamespaceDefinition<string, TShape>,
  deps: NamespaceClientDeps,
  instanceId: string,
  scopePath?: ScopeInstance[],
): TypedInstanceClient<TShape> {
  const { prefix, schema } = definition;
  const instancePrefix = `${prefix}.instances.${instanceId}`;

  function getInstanceValue<K extends keyof TShape & string>(
    key: K,
    state: Record<string, unknown>,
  ): unknown {
    // Try instance-specific first, fall back to base namespace
    const instanceKey = `${instancePrefix}.${key}`;
    const raw = deepGet(state, instanceKey);
    if (raw !== undefined) {
      const fieldSchema = schema.shape[key];
      if (fieldSchema) {
        const result = z.safeParse(fieldSchema, raw);
        if (result.success) return result.data;
      }
      return undefined;
    }
    // Fallback to base
    const baseKey = `${prefix}.${key}`;
    const baseRaw = deepGet(state, baseKey);
    if (baseRaw === undefined) return undefined;
    const fieldSchema = schema.shape[key];
    if (!fieldSchema) return undefined;
    const result = z.safeParse(fieldSchema, baseRaw);
    return result.success ? result.data : undefined;
  }

  return {
    get(key) {
      const state = deps.getState(scopePath);
      return getInstanceValue(key, state) as ReturnType<TypedInstanceClient<TShape>["get"]>; // SAFETY: getInstanceValue returns Zod-parsed value
    },

    getOrDefault(key, defaultValue) {
      const value = this.get(key);
      return value !== undefined ? value : defaultValue;
    },

    async set(key, value) {
      const fullKey = `${instancePrefix}.${key as string}`; // SAFETY: key is keyof TShape & string
      const fieldSchema = schema.shape[key as string]; // SAFETY: key is keyof TShape & string
      if (fieldSchema) {
        const parsed = z.safeParse(fieldSchema, value);
        if (!parsed.success) {
          return {
            success: false,
            error: { code: "VALIDATION_ERROR", message: parsed.error.message },
          };
        }
      }
      return deps.set(fullKey, value);
    },

    async reset() {
      return deps.remove(instancePrefix);
    },

    onChange(key, handler) {
      const fullKey = `${instancePrefix}.${key as string}`; // SAFETY: key is keyof TShape & string
      return deps.onChange(fullKey, (deltas) => {
        for (const delta of deltas) {
          if (delta.action === "set") (handler as (v: unknown) => void)(delta.value); // SAFETY: handler accepts the field value type
        }
      });
    },
  };
}
