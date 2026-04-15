// One-way ratchet validator for restrictive config fields

export type RatchetTransition =
  | "tightened"
  | "equal"
  | "loosened"
  | "blocked";

export interface RatchetLayerSnapshot {
  readonly layer: string;
  readonly values: Record<string, unknown>;
}

export interface OrderedRatchetRule {
  readonly kind: "ordered";
  readonly field: string;
  /**
   * Least restrictive -> most restrictive.
   */
  readonly order: readonly string[];
}

export interface CustomRatchetRule {
  readonly kind: "custom";
  readonly field: string;
  readonly compare: (previous: unknown, current: unknown) => RatchetTransition;
}

export type RatchetRule = OrderedRatchetRule | CustomRatchetRule;

export interface RatchetValidatorOptions {
  /**
   * Layer order from lowest priority to highest priority.
   */
  readonly layerOrder: readonly string[];
  /**
   * If true (default), once a field is blocked all later transitions for that
   * field are also reported as blocked.
   */
  readonly stickyBlocked?: boolean;
}

export interface RatchetEvaluation {
  readonly field: string;
  readonly fromLayer: string;
  readonly toLayer: string;
  readonly fromValue: unknown;
  readonly toValue: unknown;
  readonly transition: RatchetTransition;
  readonly reason?: string | undefined;
}

export interface RatchetValidationResult {
  readonly evaluations: ReadonlyArray<RatchetEvaluation>;
  readonly violations: ReadonlyArray<RatchetEvaluation>;
  readonly blocked: ReadonlyArray<RatchetEvaluation>;
}

export const DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES: readonly RatchetRule[] = [
  {
    kind: "ordered",
    field: "changePolicy",
    order: [
      "direct-allowed",
      "staging-gate",
      "full-pipeline",
      "emergency-override",
    ],
  },
  {
    kind: "ordered",
    field: "visibility",
    order: ["public", "admin", "platform", "internal"],
  },
  {
    kind: "ordered",
    field: "maxOverrideLayer",
    order: [
      "session",
      "device",
      "user",
      "tenant",
      "integrator",
      "module",
      "app",
      "core",
    ],
  },
];

function rankLayer(layer: string, layerOrder: readonly string[]): number {
  const rank = layerOrder.indexOf(layer);
  if (rank >= 0) {
    return rank;
  }

  // Unknown dynamic scopes are evaluated between tenant and user.
  const tenantRank = layerOrder.indexOf("tenant");
  const userRank = layerOrder.indexOf("user");
  if (tenantRank >= 0 && userRank >= 0 && userRank > tenantRank) {
    return tenantRank + 0.5;
  }

  return Number.MAX_SAFE_INTEGER;
}

function compareOrdered(
  order: readonly string[],
  previous: unknown,
  current: unknown,
): RatchetTransition {
  if (typeof previous !== "string" || typeof current !== "string") {
    return "blocked";
  }

  const prevIndex = order.indexOf(previous);
  const currentIndex = order.indexOf(current);
  if (prevIndex < 0 || currentIndex < 0) {
    return "blocked";
  }

  if (currentIndex < prevIndex) {
    return "loosened";
  }

  if (currentIndex === prevIndex) {
    return "equal";
  }

  return "tightened";
}

function compareByRule(
  rule: RatchetRule,
  previous: unknown,
  current: unknown,
): RatchetTransition {
  if (rule.kind === "ordered") {
    return compareOrdered(rule.order, previous, current);
  }

  return rule.compare(previous, current);
}

export function validateOneWayRatchet(
  layers: ReadonlyArray<RatchetLayerSnapshot>,
  rules: ReadonlyArray<RatchetRule>,
  options: RatchetValidatorOptions,
): RatchetValidationResult {
  const layerOrder = options.layerOrder;
  const stickyBlocked = options.stickyBlocked ?? true;

  const sortedLayers = [...layers].sort(
    (a, b) => rankLayer(a.layer, layerOrder) - rankLayer(b.layer, layerOrder),
  );

  const evaluations: RatchetEvaluation[] = [];

  for (const rule of rules) {
    let previousLayer: string | undefined;
    let previousValue: unknown;
    let blockedReason: string | undefined;

    for (const layer of sortedLayers) {
      if (!(rule.field in layer.values)) {
        continue;
      }

      const currentValue = layer.values[rule.field];
      if (previousLayer === undefined) {
        previousLayer = layer.layer;
        previousValue = currentValue;
        continue;
      }

      if (stickyBlocked && blockedReason !== undefined) {
        evaluations.push({
          field: rule.field,
          fromLayer: previousLayer,
          toLayer: layer.layer,
          fromValue: previousValue,
          toValue: currentValue,
          transition: "blocked",
          reason: blockedReason,
        });
        previousLayer = layer.layer;
        previousValue = currentValue;
        continue;
      }

      const transition = compareByRule(rule, previousValue, currentValue);
      const reason =
        transition === "blocked"
          ? `Cannot compare field '${rule.field}' with configured ratchet rule`
          : transition === "loosened"
            ? `Field '${rule.field}' loosened from '${String(previousValue)}' to '${String(currentValue)}'`
            : undefined;

      if (transition === "blocked" && stickyBlocked) {
        blockedReason = reason;
      }

      evaluations.push({
        field: rule.field,
        fromLayer: previousLayer,
        toLayer: layer.layer,
        fromValue: previousValue,
        toValue: currentValue,
        transition,
        reason,
      });

      if (transition === "blocked" && !stickyBlocked) {
        // Keep the last comparable baseline so a later known value can recover.
        continue;
      }

      previousLayer = layer.layer;
      previousValue = currentValue;
    }
  }

  const violations = evaluations.filter((entry) => entry.transition === "loosened");
  const blocked = evaluations.filter((entry) => entry.transition === "blocked");

  return {
    evaluations,
    violations,
    blocked,
  };
}
