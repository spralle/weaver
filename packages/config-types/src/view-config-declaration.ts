// View configuration declaration type and defineViewConfig helper

import type { ConfigurationPropertySchema } from "./property-schema.js";

/**
 * Declares configuration properties owned by a specific view.
 * Used in co-located *.config.ts files discovered at build time.
 */
export interface ViewConfigDeclaration {
  readonly viewId: string;
  readonly schemas: ReadonlyArray<ConfigurationPropertySchema>;
  readonly description?: string | undefined;
  readonly category?: string | undefined;
}

/**
 * Identity function providing IDE autocompletion and type-checking
 * when authoring *.config.ts view configuration files.
 *
 * Follows the same DX pattern as Vite's defineConfig.
 */
export function defineViewConfig(
  declaration: ViewConfigDeclaration,
): ViewConfigDeclaration {
  return declaration;
}
