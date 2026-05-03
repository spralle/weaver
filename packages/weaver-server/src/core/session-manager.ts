// Override session manager — ephemeral emergency override sessions
import type { AuditService } from "../audit/audit-service.js";
import type { WeaverConfigService } from "./config-service.js";

export interface SessionManagerOptions {
  configService: WeaverConfigService;
  auditService: AuditService;
}

export interface OverrideSessionRequest {
  reason: string;
  activatedBy: string;
  duration?: number; // minutes, default 60
}

export interface OverrideSessionInfo {
  id: string;
  activatedBy: string;
  reason: string;
  activatedAt: string;
  expiresAt: string;
  overrides: Record<string, unknown>;
  followUpDeadline: string;
}

export interface SessionManager {
  activate(request: OverrideSessionRequest): Promise<OverrideSessionInfo>;
  deactivate(sessionId: string, actor: string): Promise<void>;
  getSession(sessionId: string): OverrideSessionInfo | undefined;
  setOverride(sessionId: string, key: string, value: unknown, actor: string): Promise<void>;
  listActiveSessions(): OverrideSessionInfo[];
}

function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isExpired(session: OverrideSessionInfo): boolean {
  return new Date(session.expiresAt).getTime() <= Date.now();
}

export function createSessionManager(options: SessionManagerOptions): SessionManager {
  const { auditService } = options;
  const sessions = new Map<string, OverrideSessionInfo>();

  return {
    async activate(request: OverrideSessionRequest): Promise<OverrideSessionInfo> {
      const now = new Date();
      const durationMs = (request.duration ?? 60) * 60_000;
      const session: OverrideSessionInfo = {
        id: generateId(),
        activatedBy: request.activatedBy,
        reason: request.reason,
        activatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + durationMs).toISOString(),
        overrides: {},
        followUpDeadline: new Date(now.getTime() + 24 * 60 * 60_000).toISOString(),
      };
      sessions.set(session.id, session);

      await auditService.record({
        timestamp: now.toISOString(),
        actor: request.activatedBy,
        action: "override",
        key: "",
        layer: "override",
        environment: "",
        isEmergencyOverride: true,
        metadata: { sessionId: session.id, reason: request.reason },
      });

      return session;
    },

    async deactivate(sessionId: string, actor: string): Promise<void> {
      const session = sessions.get(sessionId);
      if (!session) return;
      sessions.delete(sessionId);

      await auditService.record({
        timestamp: new Date().toISOString(),
        actor,
        action: "override",
        key: "",
        layer: "override",
        environment: "",
        isEmergencyOverride: true,
        metadata: { sessionId, action: "deactivate" },
      });
    },

    getSession(sessionId: string): OverrideSessionInfo | undefined {
      const session = sessions.get(sessionId);
      if (!session) return undefined;
      if (isExpired(session)) {
        sessions.delete(sessionId);
        return undefined;
      }
      return session;
    },

    async setOverride(sessionId: string, key: string, value: unknown, actor: string): Promise<void> {
      const session = sessions.get(sessionId);
      if (!session || isExpired(session)) {
        throw new Error(`Session ${sessionId} not found or expired`);
      }
      session.overrides[key] = value;

      await auditService.record({
        timestamp: new Date().toISOString(),
        actor,
        action: "override",
        key,
        layer: "override",
        environment: "",
        isEmergencyOverride: true,
        newValue: value,
        metadata: { sessionId },
      });
    },

    listActiveSessions(): OverrideSessionInfo[] {
      const active: OverrideSessionInfo[] = [];
      for (const [id, session] of sessions) {
        if (isExpired(session)) {
          sessions.delete(id);
        } else {
          active.push(session);
        }
      }
      return active;
    },
  };
}
