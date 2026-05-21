// @weaver/config-engine — Configuration resolution engine (iteration 1)

// contract-derivation.ts — Package.json contract metadata extraction
export type {
  ContractMetadata,
  PackageJsonInput,
} from "./contract-derivation.js";
// deep.ts — Deep object path utilities
export { deepGet, deepRemove, deepSet } from "./deep.js";
// json-schema-generator.ts — JSON Schema generation
export type {
  JsonSchemaDocument,
  JsonSchemaProperty,
} from "./json-schema-generator.js";

// layers.ts — Layer resolution engine
export type { ResolvedConfiguration } from "./layers.js";
export {
  inspectKey,
  resolveConfiguration,
} from "./layers.js";
// merge.ts — Deep merge utility
export { deepMerge } from "./merge.js";
// namespace.ts — Namespace utilities
export {
  deriveNamespace,
  extractNamespace,
  qualifyKey,
  validateKeyFormat,
} from "./namespace.js";
// path.ts — Bracket-aware path parsing
export { buildPath, isCompoundSegment, parsePath, pathDepth } from "./path.js";
// schema-diff.ts — Schema comparison utilities
export type { BreakingChange } from "./schema-diff.js";
export {
  detectBreakingChanges,
  diffSchemaKeys,
  getSchemaProperties,
  getSchemaPropertyType,
  schemasEqual,
} from "./schema-diff.js";
// schema-registry.ts — Schema aggregation
export type {
  ComposedSchemaEntry,
  ComposeResult,
  ConfigurationSchemaDeclaration,
  ConfigurationSchemaRegistry,
  RegisterSchemaResult,
  SchemaCompositionError,
  UnregisterSchemaResult,
} from "./schema-registry.js";
export {
  composeConfigurationSchemas,
  createSchemaRegistry,
} from "./schema-registry.js";
// scope.ts — Scope chain builder
export type { BuildScopeChainResult, ScopeChainEntry } from "./scope.js";
// utils — shared utilities (formerly @weaver/storage-provider-core)
export { cloneValue } from "./utils/clone.js";
export { extractErrorMessage, isNodeError } from "./utils/error-utils.js";
export type { LogFields, WeaverLogger } from "./utils/logger.js";
export { consoleLogger } from "./utils/logger.js";
export { safeParseConfigEntries } from "./utils/validation.js";
export { readonlyGuard } from "./utils/write-utils.js";
export { getCachedRegex, isSafePattern, clearRegexCache } from "./regex-cache.js";
