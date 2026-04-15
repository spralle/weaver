// Policy validation — checks changePolicy assignments for security conventions

import type { ComposedSchemaEntry } from "@weaver/config-engine";

export interface PolicyViolation {
  readonly key: string;
  readonly violation: string;
  readonly severity: "error" | "warning";
  readonly currentPolicy: string;
  readonly suggestedPolicy?: string | undefined;
}

const SECURITY_SENSITIVE_PATTERN = /password|secret|apiKey|token|credential/i;

/**
 * Validates changePolicy assignments against security conventions.
 *
 * Rules:
 * 1. Security-sensitive key names with direct-allowed → error
 * 2. Internal visibility with direct-allowed → warning
 * 3. Restart-required reload behavior with direct-allowed → warning
 */
export function validateChangePolicies(
  schemas: Map<string, ComposedSchemaEntry>,
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const [key, entry] of schemas) {
    const policy = entry.schema.changePolicy ?? "direct-allowed";

    // Rule 1: Security-sensitive key names should not use direct-allowed
    if (SECURITY_SENSITIVE_PATTERN.test(key) && policy === "direct-allowed") {
      violations.push({
        key,
        violation: `Security-sensitive key "${key}" uses "${policy}" policy`,
        severity: "error",
        currentPolicy: policy,
        suggestedPolicy: "full-pipeline",
      });
    }

    // Rule 2: Internal visibility with direct-allowed
    if (entry.schema.visibility === "internal" && policy === "direct-allowed") {
      violations.push({
        key,
        violation: `Internal-visibility key "${key}" uses "${policy}" policy`,
        severity: "warning",
        currentPolicy: policy,
        suggestedPolicy: "staging-gate",
      });
    }

    // Rule 3: Restart-required reload behavior with direct-allowed
    if (entry.schema.reloadBehavior === "restart-required" && policy === "direct-allowed") {
      violations.push({
        key,
        violation: `Restart-required key "${key}" uses "${policy}" policy`,
        severity: "warning",
        currentPolicy: policy,
        suggestedPolicy: "staging-gate",
      });
    }
  }

  return violations;
}
