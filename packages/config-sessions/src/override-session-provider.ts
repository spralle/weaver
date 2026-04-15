// OverrideSession provider — session lifecycle management with expiration and audit

import type {
  ConfigurationLayerData,
  ConfigurationStorageProvider,
  OverrideSession,
  SessionActivationRequest,
  SessionDeactivationResult,
  WriteResult,
} from "@weaver/config-types";

export interface AuditEntry {
  action: string;
  sessionId: string;
  timestamp: string;
  details?: Record<string, unknown> | undefined;
}

export interface OverrideSessionProviderOptions {
  /** Layer name for this session provider (default: "session") */
  layer?: string | undefined;
  /** Provider ID (default: "override-session") */
  id?: string | undefined;
  defaultDurationMs?: number | undefined;
  onAudit?: ((entry: AuditEntry) => void) | undefined;
  timer?: {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (id: unknown) => void;
  } | undefined;
}

export interface OverrideSessionController {
  activate(request: SessionActivationRequest): OverrideSession;
  deactivate(): SessionDeactivationResult;
  extend(durationMs?: number | undefined): OverrideSession;
  getSession(): OverrideSession | null;
  isActive(): boolean;
  readonly provider: ConfigurationStorageProvider;
  dispose(): void;
}

const DEFAULT_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createOverrideSessionProvider(
  options?: OverrideSessionProviderOptions | undefined,
): OverrideSessionController {
  const defaultDurationMs = options?.defaultDurationMs ?? DEFAULT_DURATION_MS;
  const onAudit = options?.onAudit;
  const timerImpl = options?.timer ?? {
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: unknown) => clearTimeout(id),
  };

  let session: OverrideSession | null = null;
  let timerId: unknown = null;
  let currentDurationMs = defaultDurationMs;

  // Ephemeral in-memory storage — entries map is the single source of truth
  const entries: Record<string, unknown> = {};

  function emitAudit(action: string, details?: Record<string, unknown> | undefined): void {
    if (onAudit === undefined || session === null) return;
    onAudit({ action, sessionId: session.id, timestamp: nowIso(), details });
  }

  function clearTimer(): void {
    if (timerId !== null) {
      timerImpl.clearTimeout(timerId);
      timerId = null;
    }
  }

  function clearAllEntries(): number {
    const keys = Object.keys(entries);
    for (const key of keys) {
      delete entries[key];
    }
    return keys.length;
  }

  function performDeactivation(action: "deactivate" | "expire"): void {
    if (session === null) return;
    const sessionId = session.id;
    const overridesCleared = clearAllEntries();

    if (onAudit !== undefined) {
      onAudit({ action, sessionId, timestamp: nowIso(), details: { overridesCleared } });
    }

    session = null;
  }

  function startTimer(durationMs: number): void {
    clearTimer();
    timerId = timerImpl.setTimeout(() => {
      timerId = null;
      performDeactivation("expire");
    }, durationMs);
  }

  function snapshotSession(): OverrideSession {
    if (session === null) {
      throw new Error("No active session");
    }
    return { ...session, overrides: { ...entries } };
  }

  const layerName = options?.layer ?? "session";
  const providerId = options?.id ?? "override-session";

  // Wrapping provider that keeps entries map in sync with session overrides
  const provider: ConfigurationStorageProvider = {
    id: providerId,
    layer: layerName,
    writable: true,

    async load(): Promise<ConfigurationLayerData> {
      return { entries: { ...entries } };
    },

    async write(key: string, value: unknown): Promise<WriteResult> {
      entries[key] = value;
      if (session !== null) {
        session = { ...session, overrides: { ...entries } };
      }
      return { success: true };
    },

    async remove(key: string): Promise<WriteResult> {
      delete entries[key];
      if (session !== null) {
        session = { ...session, overrides: { ...entries } };
      }
      return { success: true };
    },
  };

  return {
    activate(request: SessionActivationRequest): OverrideSession {
      if (session !== null) {
        throw new Error("Session already active");
      }

      const id = generateSessionId();
      const activatedAt = nowIso();
      const durationMs = request.durationMs ?? defaultDurationMs;
      currentDurationMs = durationMs;
      const expiresAt = new Date(Date.now() + durationMs).toISOString();

      session = {
        id,
        activatedAt,
        expiresAt,
        activatedBy: "system",
        reason: request.reason,
        isActive: true,
        overrides: {},
      };

      startTimer(durationMs);
      emitAudit("activate", { reason: request.reason, durationMs });

      return snapshotSession();
    },

    deactivate(): SessionDeactivationResult {
      if (session === null) {
        throw new Error("No active session");
      }

      clearTimer();

      const sessionId = session.id;
      const overridesCleared = Object.keys(entries).length;

      emitAudit("deactivate", { overridesCleared });
      clearAllEntries();
      session = null;

      return {
        sessionId,
        deactivatedAt: nowIso(),
        overridesCleared,
        auditRecorded: onAudit !== undefined,
      };
    },

    extend(durationMs?: number | undefined): OverrideSession {
      if (session === null) {
        throw new Error("No active session");
      }

      const newDurationMs = durationMs ?? currentDurationMs;
      currentDurationMs = newDurationMs;
      const expiresAt = new Date(Date.now() + newDurationMs).toISOString();

      session = { ...session, expiresAt };
      startTimer(newDurationMs);
      emitAudit("extend", { durationMs: newDurationMs });

      return snapshotSession();
    },

    getSession(): OverrideSession | null {
      if (session === null) return null;
      return snapshotSession();
    },

    isActive(): boolean {
      return session !== null;
    },

    get provider(): ConfigurationStorageProvider {
      return provider;
    },

    dispose(): void {
      clearTimer();
      if (session !== null) {
        performDeactivation("deactivate");
      }
    },
  };
}
