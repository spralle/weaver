// Package.json contract derivation utility

import { deriveNamespace } from "./namespace.js";

export interface PackageJsonInput {
  name: string;
  version?: string | undefined;
  description?: string | undefined;
  ghost?: { configNamespace?: string | undefined } | undefined;
}

export interface ContractMetadata {
  pluginId: string;
  namespace: string;
  version: string;
  description: string;
}

/**
 * Derives configuration contract metadata from a plugin's package.json.
 *
 * - pluginId: the package name as-is
 * - namespace: derived from the package name via deriveNamespace(),
 *   or from ghost.configNamespace if explicitly provided
 * - version: from pkg.version, defaults to "0.0.0"
 * - description: from pkg.description, defaults to ""
 */
export function deriveContractFromPackageJson(
  pkg: PackageJsonInput,
): ContractMetadata {
  const namespace =
    pkg.ghost?.configNamespace ?? deriveNamespace(pkg.name);

  return {
    pluginId: pkg.name,
    namespace,
    version: pkg.version ?? "0.0.0",
    description: pkg.description ?? "",
  };
}
