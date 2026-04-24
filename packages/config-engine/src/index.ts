// @weaver/config-engine — Configuration resolution engine (iteration 1)

// contract-derivation.ts — Package.json contract metadata extraction
export type {
  ContractMetadata,
  PackageJsonInput,
} from "./contract-derivation.js";
export { deriveContractFromPackageJson } from "./contract-derivation.js";
// json-schema-generator.ts — JSON Schema generation
export type {
  JsonSchemaDocument,
  JsonSchemaProperty,
} from "./json-schema-generator.js";
export {
  generateJsonSchema,
  generateSinglePropertySchema,
} from "./json-schema-generator.js";

// layers.ts — Layer resolution engine
export type { ResolvedConfiguration } from "./layers.js";
export {
  inspectKey,
  resolveConfiguration,
  resolveConfigurationWithCeiling,
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
export { buildScopeChain } from "./scope.js";

// zod-schema-generator.ts — Zod codegen (string-based)
export {
  generateZodForProperty,
  generateZodSchemaSource,
  sanitizeKeyToIdentifier,
} from "./zod-schema-generator.js";
