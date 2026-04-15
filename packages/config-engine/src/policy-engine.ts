// Policy validation engine — evaluates changePolicy rules for config writes

import type {
  ConfigurationPropertySchema,
  ConfigurationAccessContext,
} from "@weaver/config-types";
import { canWrite } from "./auth.js";

export type PolicyDecision =
  | { readonly outcome: "allowed" }
  | { readonly outcome: "requires-promotion"; readonly message: string }
  | { readonly outcome: "requires-emergency-auth"; readonly message: string }
  | { readonly outcome: "denied"; readonly reason: string };

/**
 * Extended access context that includes an optional override reason
 * for emergency override authorization.
 */
export interface PolicyEvaluationContext extends ConfigurationAccessContext {
  overrideReason?: string | undefined;
}

/**
 * Evaluates whether a configuration change is allowed based on the key's
 * changePolicy, the caller's auth context, and the target layer.
 *
 * Decision flow:
 * 1. Check base write permission via canWrite()
 * 2. Evaluate changePolicy (defaults to 'direct-allowed')
 */
export function evaluateChangePolicy(
  schema: ConfigurationPropertySchema,
  context: PolicyEvaluationContext,
  layer: string,
): PolicyDecision {
  // Step 1: Check base write permission
  if (!canWrite(context, layer, "", schema)) {
    return {
      outcome: "denied",
      reason: `Write denied: insufficient permissions for layer '${layer}'`,
    };
  }

  // Step 2: Evaluate changePolicy
  const policy = schema.changePolicy ?? "direct-allowed";

  switch (policy) {
    case "direct-allowed":
      return { outcome: "allowed" };

    case "staging-gate":
      return {
        outcome: "requires-promotion",
        message:
          "Change requires staging validation before production deployment",
      };

    case "full-pipeline":
      return {
        outcome: "requires-promotion",
        message: "Change requires full CI/CD pipeline review",
      };

    case "emergency-override": {
      if (
        context.sessionMode === "emergency-override" &&
        context.overrideReason !== undefined &&
        context.overrideReason.length > 0
      ) {
        return { outcome: "allowed" };
      }
      return {
        outcome: "requires-emergency-auth",
        message: "This key requires emergency override authorization",
      };
    }
  }
}
