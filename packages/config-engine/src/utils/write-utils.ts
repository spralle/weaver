import type { WriteResult } from "@weaver-conf/config-types";

/**
 * Returns a readonly-rejection WriteResult for providers that don't support writes.
 */
export function readonlyGuard(providerName: string): WriteResult {
  return {
    success: false,
    error: { code: "READONLY", message: `${providerName} is read-only` },
  };
}
