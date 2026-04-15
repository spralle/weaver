// @weaver/config-engine — Configuration resolution engine (iteration 1)

// merge.ts — Deep merge utility
export { deepMerge } from "./merge.js";

// namespace.ts — Namespace utilities
export {
  qualifyKey,
  deriveNamespace,
  validateKeyFormat,
  extractNamespace,
} from "./namespace.js";

// scope.ts — Scope chain builder
export type { ScopeChainEntry, BuildScopeChainResult } from "./scope.js";
export { buildScopeChain } from "./scope.js";

// layers.ts — Layer resolution engine
export type { ResolvedConfiguration } from "./layers.js";
export {
  resolveConfiguration,
  inspectKey,
  resolveConfigurationWithCeiling,
} from "./layers.js";

// schema-registry.ts — Schema aggregation
export type {
  ConfigurationSchemaDeclaration,
  ComposedSchemaEntry,
  SchemaCompositionError,
  ComposeResult,
  RegisterSchemaResult,
  UnregisterSchemaResult,
  ConfigurationSchemaRegistry,
} from "./schema-registry.js";
export {
  composeConfigurationSchemas,
  createSchemaRegistry,
} from "./schema-registry.js";

// contract-derivation.ts — Package.json contract metadata extraction
export type {
  PackageJsonInput,
  ContractMetadata,
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

// zod-schema-generator.ts — Zod codegen (string-based)
export {
  generateZodSchemaSource,
  generateZodForProperty,
  sanitizeKeyToIdentifier,
} from "./zod-schema-generator.js";

