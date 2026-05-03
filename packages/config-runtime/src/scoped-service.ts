// Scoped configuration service — namespace-qualified key lookups for plugins

import { qualifyKey } from "@weaver/config-engine";
import type {
  ConfigurationInspection,
  ConfigurationService,
  ScopedConfigurationService,
  ScopeInstance,
  ViewConfigurationService,
} from "@weaver/config-types";
import { createViewConfigurationService } from "./view-service.js";

/**
 * Creates a ScopedConfigurationService that automatically qualifies all keys
 * with the given namespace prefix. Provides plugin-facing config access.
 */
export function createScopedConfigurationService(
  rootService: ConfigurationService,
  namespace: string,
): ScopedConfigurationService {
  return {
    get<T>(relativeKey: string): T | undefined {
      return rootService.get<T>(qualifyKey(namespace, relativeKey));
    },

    getWithDefault<T>(relativeKey: string, defaultValue: T): T {
      return rootService.getWithDefault<T>(
        qualifyKey(namespace, relativeKey),
        defaultValue,
      );
    },

    getForScope<T>(
      relativeKey: string,
      scopePath: ScopeInstance[],
    ): T | undefined {
      return rootService.getForScope<T>(
        qualifyKey(namespace, relativeKey),
        scopePath,
      );
    },

    withScope(scopePath: ScopeInstance[]): ScopedConfigurationService {
      // Creates a wrapper where get() calls root.getForScope() with baked-in scopePath
      const parent = this;
      return {
        get<T>(relativeKey: string): T | undefined {
          return rootService.getForScope<T>(
            qualifyKey(namespace, relativeKey),
            scopePath,
          );
        },

        getWithDefault<T>(relativeKey: string, defaultValue: T): T {
          const value = this.get<T>(relativeKey);
          return value !== undefined ? value : defaultValue;
        },

        getForScope<T>(
          relativeKey: string,
          innerScopePath: ScopeInstance[],
        ): T | undefined {
          return rootService.getForScope<T>(
            qualifyKey(namespace, relativeKey),
            innerScopePath,
          );
        },

        withScope(innerScopePath: ScopeInstance[]): ScopedConfigurationService {
          return parent.withScope(innerScopePath);
        },

        forView(viewId: string): ViewConfigurationService {
          return createViewConfigurationService(rootService, namespace, viewId);
        },

        inspect<T>(relativeKey: string): ConfigurationInspection<T> {
          return rootService.inspect<T>(qualifyKey(namespace, relativeKey));
        },

        onChange(
          relativeKey: string,
          listener: (value: unknown) => void,
        ): () => void {
          return rootService.onChange(
            qualifyKey(namespace, relativeKey),
            listener,
          );
        },

        get root(): ConfigurationService {
          return rootService;
        },
      };
    },

    forView(viewId: string): ViewConfigurationService {
      return createViewConfigurationService(rootService, namespace, viewId);
    },

    inspect<T>(relativeKey: string): ConfigurationInspection<T> {
      return rootService.inspect<T>(qualifyKey(namespace, relativeKey));
    },

    onChange(
      relativeKey: string,
      listener: (value: unknown) => void,
    ): () => void {
      return rootService.onChange(qualifyKey(namespace, relativeKey), listener);
    },

    get root(): ConfigurationService {
      return rootService;
    },
  };
}
