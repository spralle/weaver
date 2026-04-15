# @weaver/config-policy

> Change control policies, ratchet validation, and emergency override tracking for Weaver configuration.

## Installation

```bash
bun add @weaver/config-policy
```

## Overview

`@weaver/config-policy` provides governance controls for configuration changes. It includes a policy engine that evaluates `changePolicy` rules (direct-allowed, staging-gate, full-pipeline, emergency-override), a validation function that audits policy assignments against security conventions, a one-way ratchet validator that prevents loosening of restrictive settings across layers, and an override tracker for managing emergency override lifecycles with follow-up deadlines.

These tools compose with `@weaver/config-auth` — the policy engine accepts a `canWrite` function from the auth layer and layers additional policy checks on top.

## Usage

### Evaluating change policies

```typescript
import { evaluateChangePolicy } from "@weaver/config-policy";
import { withAuth } from "@weaver/config-auth";

const auth = withAuth({ /* ... */ });

const decision = evaluateChangePolicy(
  { type: "string", changePolicy: "staging-gate" },
  { roles: ["tenantAdmin"], sessionMode: undefined },
  "tenant",
  auth.canWrite,
);

// decision: { outcome: "requires-promotion", message: "Change requires staging validation..." }
```

### Policy validation

```typescript
import { validateChangePolicies } from "@weaver/config-policy";

const violations = validateChangePolicies(registry.getSchemas());
// Flags: security-sensitive keys with "direct-allowed", internal visibility
// with "direct-allowed", restart-required keys with "direct-allowed"

for (const v of violations) {
  console.warn(`${v.severity}: ${v.violation} → suggest ${v.suggestedPolicy}`);
}
```

### One-way ratchet validation

```typescript
import {
  validateOneWayRatchet,
  DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
} from "@weaver/config-policy";

const result = validateOneWayRatchet(
  DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES,
  [
    { layer: "core", values: { changePolicy: "full-pipeline", visibility: "admin" } },
    { layer: "tenant", values: { changePolicy: "direct-allowed", visibility: "public" } },
  ],
  { layerOrder: ["core", "tenant", "user"] },
);

result.violations;
// [{ field: "changePolicy", transition: "loosened", fromLayer: "core", toLayer: "tenant", ... }]
```

### Emergency override tracking

```typescript
import { createInMemoryOverrideTracker } from "@weaver/config-policy";

const tracker = createInMemoryOverrideTracker({
  followUpDeadlineMs: 24 * 60 * 60 * 1000, // 24 hours
});

const record = await tracker.create({
  id: "override-1",
  key: "app.security.maxRetries",
  overriddenBy: "admin@example.com",
  reason: "Emergency: brute-force attack mitigation",
  createdAt: new Date().toISOString(),
  originalValue: 5,
  overrideValue: 1,
});

const overdue = await tracker.listOverdue();
await tracker.regularize("override-1", "ops@example.com");
```

## API Reference

| Export | Description |
|---|---|
| `evaluateChangePolicy(schema, context, layer, canWrite)` | Evaluate whether a change is allowed by policy |
| `validateChangePolicies(schemas)` | Audit policy assignments for security violations |
| `validateOneWayRatchet(rules, snapshots, options)` | Validate ratchet constraints across layers |
| `DEFAULT_PLUGIN_MANAGEMENT_RATCHET_RULES` | Default ratchet rules for changePolicy, visibility, maxOverrideLayer |
| `computeDeadline(createdAt, deadlineMs?)` | Compute follow-up deadline ISO string |
| `createFileSystemOverrideTracker(options)` | File system override tracker |
| `createInMemoryOverrideTracker(options?)` | In-memory override tracker (testing) |

### Types

| Type | Description |
|---|---|
| `PolicyDecision` | Outcome: allowed, requires-promotion, requires-emergency-auth, denied |
| `PolicyEvaluationContext` | Access context extended with `overrideReason` |
| `PolicyViolation` | Validation finding with severity and suggested policy |
| `RatchetRule` | Ordered or custom ratchet rule definition |
| `RatchetValidationResult` | Evaluations, violations, and blocked transitions |
| `OverrideTracker` | Interface: create, listActive, regularize, listOverdue |

## License

MIT
