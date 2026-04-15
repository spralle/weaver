import type { ConfigurationLayer, ScopeInstance } from "./types.js";
import type {
  GodModeSession,
  SessionActivationRequest,
  SessionDeactivationResult,
} from "./session.js";

/**
 * Minimal handle for session lifecycle — satisfied by GodModeSessionController
 * without creating a dependency from config-types to config-providers.
 */
export interface ConfigurationSessionHandle {
  activate(request: SessionActivationRequest): GodModeSession;
  deactivate(): SessionDeactivationResult;
  extend(durationMs?: number | undefined): GodModeSession;
  getSession(): GodModeSession | null;
  isActive(): boolean;
}

export interface ConfigurationInspection<T> {
  key: string;
  effectiveValue: T | undefined;
  effectiveLayer: ConfigurationLayer | string | undefined;
  coreValue?: T | undefined;
  appValue?: T | undefined;
  moduleValue?: T | undefined;
  integratorValue?: T | undefined;
  tenantValue?: T | undefined;
  userValue?: T | undefined;
  deviceValue?: T | undefined;
  sessionValue?: T | undefined;
  scopeValues?: ReadonlyArray<{ scopeId: string; value: T }> | undefined;
}

export interface ConfigurationService {
  get<T>(key: string): T | undefined;
  getWithDefault<T>(key: string, defaultValue: T): T;
  getAtLayer<T>(layer: ConfigurationLayer | string, key: string): T | undefined;
  getForScope<T>(key: string, scopePath: ScopeInstance[]): T | undefined;
  inspect<T>(key: string): ConfigurationInspection<T>;
  set(key: string, value: unknown, layer?: ConfigurationLayer): void;
  remove(key: string, layer: ConfigurationLayer): void;
  onChange(key: string, listener: (value: unknown) => void): () => void;
  getNamespace(prefix: string): Record<string, unknown>;
  readonly session?: ConfigurationSessionHandle | undefined;
}

export interface ScopedConfigurationService {
  get<T>(relativeKey: string): T | undefined;
  getWithDefault<T>(relativeKey: string, defaultValue: T): T;
  getForScope<T>(relativeKey: string, scopePath: ScopeInstance[]): T | undefined;
  withScope(scopePath: ScopeInstance[]): ScopedConfigurationService;
  forView(viewId: string): ViewConfigurationService;
  inspect<T>(relativeKey: string): ConfigurationInspection<T>;
  onChange(relativeKey: string, listener: (value: unknown) => void): () => void;
  readonly root: ConfigurationService;
}

export interface ViewConfigurationService {
  get<T>(key: string): T | undefined;
  getWithDefault<T>(key: string, defaultValue: T): T;
  getForInstance<T>(instanceId: string, key: string): T | undefined;
  setForInstance(instanceId: string, key: string, value: unknown): void;
  resetInstance(instanceId: string): void;
}

export interface ServiceConfigurationService {
  get<T>(key: string): T | undefined;
  getWithDefault<T>(key: string, defaultValue: T): T;
  getFromNamespace<T>(namespace: string, key: string): T | undefined;
  onChange(key: string, listener: (value: unknown) => void): () => void;
  readonly pendingRestart: boolean;
  onRestartRequired(listener: () => void): () => void;
}
