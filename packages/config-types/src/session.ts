export type SessionType = string;

/** @deprecated Use `SessionType` instead. */
export type SessionMode = SessionType;

export type PropertySessionMode = "allowed" | "restricted" | "blocked";

export interface SessionLayerMetadata {
  activatedBy: string;
  activatedAt: number;
  reason: string;
  mode: SessionType;
  expiresAt?: number | undefined;
}

export interface SessionLayer {
  readonly overrides: ReadonlyMap<string, unknown>;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  clear(): void;
  readonly active: boolean;
  readonly metadata: SessionLayerMetadata | null;
}

export interface OverrideSession {
  id: string;
  activatedAt: string;
  expiresAt: string;
  activatedBy: string;
  reason: string;
  isActive: boolean;
  overrides: Record<string, unknown>;
}

export interface SessionActivationRequest {
  reason: string;
  durationMs?: number | undefined;
  elevatedAuth?: { token: string; method: string } | undefined;
}

export interface SessionDeactivationResult {
  sessionId: string;
  deactivatedAt: string;
  overridesCleared: number;
  auditRecorded: boolean;
}

/** @deprecated Use `OverrideSession` instead. */
export type GodModeSession = OverrideSession;
