// @weaver/config-policy — Policy evaluation, validation, and override tracking

// Policy engine
export type { PolicyDecision, PolicyEvaluationContext } from "./policy-engine.js";
export { evaluateChangePolicy } from "./policy-engine.js";

// Policy validation
export type { PolicyViolation } from "./policy-validation.js";
export { validateChangePolicies } from "./policy-validation.js";

// Ratchet validator
export type {
  RatchetTransition,
  RatchetLayerSnapshot,
  OrderedRatchetRule,
  CustomRatchetRule,
  RatchetRule,
  RatchetValidatorOptions,
  RatchetEvaluation,
  RatchetValidationResult,
} from "./ratchet-validator.js";
export {
  DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
  validateOneWayRatchet,
} from "./ratchet-validator.js";

// Override tracker
export type { OverrideTracker, OverrideTrackerOptions } from "./override-tracker.js";
export { computeDeadline } from "./override-tracker.js";
export { createFileSystemOverrideTracker } from "./fs-override-tracker.js";
export { createInMemoryOverrideTracker } from "./memory-override-tracker.js";
