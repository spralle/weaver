// ServiceConfigurationService factory — namespace-scoped config for backend services

import type {
  ConfigurationService,
  ServiceConfigurationService,
  ConfigurationPropertySchema,
} from "@weaver/config-types";
import { qualifyKey } from "@weaver/config-engine";

export interface ServiceConfigurationOptions {
  configService: ConfigurationService;
  namespace: string;
  schemaMap?: ReadonlyMap<string, ConfigurationPropertySchema> | undefined;
}

export function createServiceConfigurationService(
  options: ServiceConfigurationOptions,
): ServiceConfigurationService {
  const { configService, namespace, schemaMap } = options;
  let restartRequired = false;
  const restartListeners = new Set<() => void>();

  // Subscribe to changes on keys that require restart
  if (schemaMap) {
    for (const [key, schema] of schemaMap) {
      if (
        schema.reloadBehavior === "restart-required" ||
        schema.reloadBehavior === "rolling-restart"
      ) {
        const qualifiedKey = qualifyKey(namespace, key);
        configService.onChange(qualifiedKey, () => {
          restartRequired = true;
          for (const listener of restartListeners) {
            listener();
          }
        });
      }
    }
  }

  return {
    get<T>(key: string): T | undefined {
      return configService.get<T>(qualifyKey(namespace, key));
    },

    getWithDefault<T>(key: string, defaultValue: T): T {
      return configService.getWithDefault<T>(
        qualifyKey(namespace, key),
        defaultValue,
      );
    },

    getFromNamespace<T>(ns: string, key: string): T | undefined {
      return configService.get<T>(qualifyKey(ns, key));
    },

    onChange(key: string, listener: (value: unknown) => void): () => void {
      return configService.onChange(qualifyKey(namespace, key), listener);
    },

    get pendingRestart(): boolean {
      return restartRequired;
    },

    onRestartRequired(listener: () => void): () => void {
      restartListeners.add(listener);
      return () => {
        restartListeners.delete(listener);
      };
    },
  };
}
