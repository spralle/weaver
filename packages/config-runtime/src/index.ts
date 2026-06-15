export { createStateContainer } from "./state-container";
export type {
  ConfigDelta,
  LayerEntry,
  StateContainer,
  StateSnapshot,
  Unsubscribe,
} from "./types";
export {
  ConfigDeltaSchema,
  LayerEntrySchema,
  StateSnapshotSchema,
} from "./types";

export { buildMountMap, resolveMountedValue, resolveMountedNamespace } from "./mounts";
export type { MountResolution, MountError, MountResult } from "./mounts";

export { createSecretResolver } from "./secret-resolver";
export type { SecretBackend, SecretResolverOptions, SecretResolver } from "./secret-resolver";

export { createScopeResolver, createScopeCache } from "./scope-resolver";
export type { ScopeResolverOptions, ScopeResolver } from "./scope-resolver";
