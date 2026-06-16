export type { MountError, MountResolution, MountResult } from "./mounts";
export {
  buildMountMap,
  resolveMountedNamespace,
  resolveMountedValue,
} from "./mounts";
export type { ScopeResolver, ScopeResolverOptions } from "./scope-resolver";
export { createScopeCache, createScopeResolver } from "./scope-resolver";
export type {
  SecretBackend,
  SecretResolver,
  SecretResolverOptions,
} from "./secret-resolver";

export { createSecretResolver } from "./secret-resolver";
export { createStateContainer } from "./state-container";
export type {
  LayerEntry,
  StateContainer,
  StateDelta,
  StateSnapshot,
  Unsubscribe,
} from "./types";
export {
  LayerEntrySchema,
  StateDeltaSchema,
  StateSnapshotSchema,
} from "./types";
