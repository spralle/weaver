# @weaver/config-sessions

> Override session provider with expiration, audit logging, and ephemeral storage for Weaver.

## Installation

```bash
bun add @weaver/config-sessions
```

## Overview

`@weaver/config-sessions` provides time-bounded override sessions for the Weaver configuration system. An override session allows temporary configuration changes that automatically expire after a configurable duration. All session lifecycle events (activate, deactivate, extend, expire) can be audited via a callback.

The session controller manages an ephemeral in-memory storage provider that integrates directly into `createConfigurationService()`. When a session expires, all overrides are automatically cleared. This is the runtime backing for `Layers.Ephemeral("session")` in a Weaver layer stack.

## Usage

### Creating and using an override session

```typescript
import { defineWeaver, Layers, replaceOnly } from "@weaver/config-types";
import { createOverrideSessionProvider } from "@weaver/config-sessions";
import { createConfigurationService } from "@weaver/config-providers";

const weaver = defineWeaver([
  Layers.Static("core"),
  Layers.Static("tenant"),
  Layers.Ephemeral("session", { merge: replaceOnly }),
] as const);

const sessionController = createOverrideSessionProvider({
  layer: "session",
  defaultDurationMs: 4 * 60 * 60 * 1000, // 4 hours
  onAudit: (entry) => console.log(`[audit] ${entry.action}:`, entry.sessionId),
});

const service = await createConfigurationService({
  providers: [coreProvider, tenantProvider],
  weaverConfig: weaver,
  session: sessionController,
});
```

### Session lifecycle

```typescript
// Activate a session
const session = sessionController.activate({
  reason: "Emergency: investigating production issue",
  durationMs: 2 * 60 * 60 * 1000, // 2 hours
});
// session: { id, activatedAt, expiresAt, isActive, overrides, ... }

// Write overrides through the config service
service.set("app.security.rateLimitRps", 1000, "session");

// Extend the session
sessionController.extend(1 * 60 * 60 * 1000); // +1 hour

// Check session state
sessionController.isActive();   // true
sessionController.getSession(); // current session snapshot

// Manually deactivate (clears all overrides)
const result = sessionController.deactivate();
// { sessionId, deactivatedAt, overridesCleared: 1, auditRecorded: true }

// Sessions also auto-expire after their duration
```

### Cleanup

```typescript
// Dispose clears timers and deactivates any active session
sessionController.dispose();
```

## API Reference

| Export | Description |
|---|---|
| `createOverrideSessionProvider(options?)` | Create a session controller with ephemeral storage provider |

### Types

| Type | Description |
|---|---|
| `OverrideSessionController` | Controller: activate, deactivate, extend, getSession, isActive, provider, dispose |
| `OverrideSessionProviderOptions` | Options: layer, id, defaultDurationMs, onAudit, timer |
| `AuditEntry` | Audit event: action, sessionId, timestamp, details |

## License

MIT
