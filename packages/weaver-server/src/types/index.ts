export {
  weaverErrorCodes,
  weaverErrorCodeSchema,
  weaverErrorSchema,
  createWeaverError,
  HTTP_STATUS_MAP,
  httpStatusForError,
} from "./errors.js";
export type { WeaverErrorCode, WeaverError } from "./errors.js";

export { configDeltaSchema } from "@weaver/config-types";
export type { ConfigDelta } from "@weaver/config-types";

export { configSnapshotSchema } from "@weaver/config-types";
export type { ConfigSnapshot } from "@weaver/config-types";

export {
  builtinProviders,
  layerProviderSchema,
  bootstrapLayerSchema,
  bootstrapConfigSchema,
} from "./bootstrap.js";
export type {
  BootstrapConfig,
  BootstrapLayer,
  LayerProvider,
} from "./bootstrap.js";
