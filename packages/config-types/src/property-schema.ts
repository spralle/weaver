import type { ConfigurationLayer } from "./types.js";
import type { PropertySessionMode } from "./session.js";

export type ConfigChangePolicy =
  | "full-pipeline"
  | "staging-gate"
  | "direct-allowed"
  | "emergency-override";

export type ConfigurationVisibility =
  | "public"
  | "admin"
  | "platform"
  | "internal";

export type ConfigurationRole =
  | "platform-ops"
  | "tenant-admin"
  | "scope-admin"
  | "integrator"
  | "user"
  | "support"
  | "system"
  | "service"
  | "platform-service";

export type ConfigReloadBehavior =
  | "hot"
  | "restart-required"
  | "rolling-restart";

export type ConfigurationJsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

export interface ConfigurationPropertySchema {
  type: ConfigurationJsonSchemaType | ReadonlyArray<ConfigurationJsonSchemaType>;
  title?: string | undefined;
  default?: unknown;
  description?: string | undefined;
  examples?: ReadonlyArray<unknown> | undefined;
  const?: unknown;
  enum?: ReadonlyArray<unknown> | undefined;
  format?: string | undefined;
  pattern?: string | undefined;
  minLength?: number | undefined;
  maxLength?: number | undefined;
  multipleOf?: number | undefined;
  minimum?: number | undefined;
  maximum?: number | undefined;
  exclusiveMinimum?: number | undefined;
  exclusiveMaximum?: number | undefined;
  minItems?: number | undefined;
  maxItems?: number | undefined;
  uniqueItems?: boolean | undefined;
  minProperties?: number | undefined;
  maxProperties?: number | undefined;
  required?: ReadonlyArray<string> | undefined;
  properties?: Readonly<Record<string, ConfigurationPropertySchema>> | undefined;
  patternProperties?: Readonly<Record<string, ConfigurationPropertySchema>> | undefined;
  additionalProperties?: boolean | ConfigurationPropertySchema | undefined;
  items?: ConfigurationPropertySchema | ReadonlyArray<ConfigurationPropertySchema> | undefined;
  oneOf?: ReadonlyArray<ConfigurationPropertySchema> | undefined;
  anyOf?: ReadonlyArray<ConfigurationPropertySchema> | undefined;
  allOf?: ReadonlyArray<ConfigurationPropertySchema> | undefined;
  not?: ConfigurationPropertySchema | undefined;

  // Unsupported by policy: schema must remain self-contained.
  $ref?: undefined;
  $defs?: undefined;

  expressionAllowed?: boolean | undefined;
  changePolicy?: ConfigChangePolicy | undefined;
  visibility?: ConfigurationVisibility | undefined;
  sensitive?: boolean | undefined;
  maxOverrideLayer?: ConfigurationLayer | undefined;
  writeRestriction?: ReadonlyArray<ConfigurationRole> | undefined;
  viewConfig?: boolean | undefined;
  instanceOverridable?: boolean | undefined;
  reloadBehavior?: ConfigReloadBehavior | undefined;
  sessionMode?: PropertySessionMode | undefined;
}
