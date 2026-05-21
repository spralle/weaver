import type { ZodType } from "zod";
import { deepGet } from "@weaver/config-engine";
import type { InstanceClient } from "./namespace.js";
import type { ConfigDelta, Unsubscribe } from "./types.js";
import type { WriteOptions, WriteResult } from "./transport.js";

export interface InstanceClientDeps {
  getState: () => Record<string, unknown>;
  set: (key: string, value: unknown, opts?: WriteOptions) => Promise<WriteResult>;
  remove: (key: string, opts?: WriteOptions) => Promise<WriteResult>;
  onChange: (pattern: string, handler: (deltas: ConfigDelta[]) => void) => Unsubscribe;
  defaultWriteLayer?: string;
}

/**
 * Reads from instance path first, falls back to base config.
 * Writes always target the instance path.
 */
export function createInstanceClient(
  basePath: string,
  instanceId: string,
  deps: InstanceClientDeps,
): InstanceClient {
  const instancePrefix = `${basePath}.instances.${instanceId}`;

  function getInstanceValue(key: string): unknown {
    const state = deps.getState();
    const instanceValue = deepGet(state, `${instancePrefix}.${key}`);
    if (instanceValue !== undefined) return instanceValue;
    return deepGet(state, `${basePath}.${key}`);
  }

  return {
    get<T = unknown>(key: string, schema?: ZodType<T>): T | undefined {
      const raw = getInstanceValue(key);
      if (raw === undefined) return undefined;
      if (schema) {
        const result = schema.safeParse(raw);
        return result.success ? result.data : undefined;
      }
      return raw as T;
    },

    getOrDefault<T = unknown>(key: string, defaultValue: T): T {
      const value = getInstanceValue(key);
      return value !== undefined ? (value as T) : defaultValue;
    },

    async set<T = unknown>(key: string, value: T): Promise<WriteResult> {
      const fullKey = `${instancePrefix}.${key}`;
      const opts: WriteOptions = {};
      if (deps.defaultWriteLayer) opts.layer = deps.defaultWriteLayer;
      return deps.set(fullKey, value, opts);
    },

    async reset(): Promise<WriteResult> {
      const opts: WriteOptions = {};
      if (deps.defaultWriteLayer) opts.layer = deps.defaultWriteLayer;
      return deps.remove(instancePrefix, opts);
    },

    onChange(pattern: string, handler: (deltas: ConfigDelta[]) => void): Unsubscribe {
      return deps.onChange(`${instancePrefix}.${pattern}`, handler);
    },
  };
}
