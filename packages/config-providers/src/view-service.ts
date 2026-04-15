// View-level configuration service with per-instance overrides

import type {
  ConfigurationService,
  ViewConfigurationService,
} from "@weaver/config-types";
import { qualifyKey } from "@weaver/config-engine";

/**
 * Builds the instance-qualified key pattern:
 * {namespace}.{viewId}.__instance__.{instanceId}.{key}
 */
function instanceKey(
  namespace: string,
  viewId: string,
  instanceId: string,
  key: string,
): string {
  return qualifyKey(namespace, `${viewId}.__instance__.${instanceId}.${key}`);
}

/**
 * Builds the base view key pattern:
 * {namespace}.{viewId}.{key}
 */
function baseViewKey(
  namespace: string,
  viewId: string,
  key: string,
): string {
  return qualifyKey(namespace, `${viewId}.${key}`);
}

/**
 * Creates a ViewConfigurationService for a specific view within a namespace.
 * Provides base view config reads and per-instance override management.
 */
export function createViewConfigurationService(
  root: ConfigurationService,
  namespace: string,
  viewId: string,
): ViewConfigurationService {
  return {
    get<T>(key: string): T | undefined {
      return root.get<T>(baseViewKey(namespace, viewId, key));
    },

    getWithDefault<T>(key: string, defaultValue: T): T {
      return root.getWithDefault<T>(
        baseViewKey(namespace, viewId, key),
        defaultValue,
      );
    },

    getForInstance<T>(instanceIdVal: string, key: string): T | undefined {
      const instKey = instanceKey(namespace, viewId, instanceIdVal, key);
      const instValue = root.get<T>(instKey);
      if (instValue !== undefined) {
        return instValue;
      }
      return this.get<T>(key);
    },

    setForInstance(instanceIdVal: string, key: string, value: unknown): void {
      const instKey = instanceKey(namespace, viewId, instanceIdVal, key);
      root.set(instKey, value);
    },

    resetInstance(instanceIdVal: string): void {
      const instPrefix = qualifyKey(
        namespace,
        `${viewId}.__instance__.${instanceIdVal}`,
      );
      const entries = root.getNamespace(instPrefix);
      for (const key of Object.keys(entries)) {
        // Remove from the highest writable layer; the service.remove needs a layer
        // but the root.set wrote without specifying a layer (highest writable).
        // We use getNamespace + remove pattern. Since remove requires a layer,
        // we use "session" as the default writable layer for instance overrides.
        root.remove(key, "session");
      }
    },
  };
}
