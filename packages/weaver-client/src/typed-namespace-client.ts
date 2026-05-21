import { z } from "zod";
import type { ZodRawShape } from "zod";
import type { ScopeInstance } from "@weaver/config-types";
import { deepGet } from "@weaver/config-engine";
import type {
  TypedNamespaceClient,
  TypedInstanceClient,
  NamespaceDefinition,
} from "./namespace.js";
import type { ConfigDelta, Unsubscribe } from "./types.js";
import type { WriteOptions, WriteResult } from "./transport.js";

export interface NamespaceClientDeps {
  getState: (scopePath?: ScopeInstance[]) => Record<string, unknown>;
  set: (key: string, value: unknown, opts?: WriteOptions) => Promise<WriteResult>;
  remove: (key: string, opts?: WriteOptions) => Promise<WriteResult>;
  onChange: (pattern: string, handler: (deltas: ConfigDelta[]) => void) => Unsubscribe;
}

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
      return getValidated(key, state) as ReturnType<TypedNamespaceClient<TShape>["get"]>;
    },

    getOrDefault(key, defaultValue) {
      const value = client.get(key);
      return value !== undefined ? value : defaultValue;
    },

    getAll() {
      const state = deps.getState(scopePath);
      const nsValue = deepGet(state, prefix);
      if (!nsValue || typeof nsValue !== "object") {
        return {} as ReturnType<TypedNamespaceClient<TShape>["getAll"]>;
      }
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(schema.shape)) {
        const fieldSchema = schema.shape[key];
        const raw = (nsValue as Record<string, unknown>)[key];
        if (raw !== undefined && fieldSchema) {
          const parsed = z.safeParse(fieldSchema, raw);
          if (parsed.success) result[key] = parsed.data;
        }
      }
      return result as ReturnType<TypedNamespaceClient<TShape>["getAll"]>;
    },

    async set(key, value, opts) {
      const fullKey = resolveKey(key as string);
      const fieldSchema = schema.shape[key as string];
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
        return deps.onChange(`${prefix}.*`, keyOrHandler as (deltas: ConfigDelta[]) => void);
      }
      const fullKey = resolveKey(keyOrHandler as string);
      const typedHandler = handler as (value: unknown) => void;
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
      return getInstanceValue(key, state) as ReturnType<TypedInstanceClient<TShape>["get"]>;
    },

    getOrDefault(key, defaultValue) {
      const value = this.get(key);
      return value !== undefined ? value : defaultValue;
    },

    async set(key, value) {
      const fullKey = `${instancePrefix}.${key as string}`;
      const fieldSchema = schema.shape[key as string];
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
      const fullKey = `${instancePrefix}.${key as string}`;
      return deps.onChange(fullKey, (deltas) => {
        for (const delta of deltas) {
          if (delta.action === "set") (handler as (v: unknown) => void)(delta.value);
        }
      });
    },
  };
}
