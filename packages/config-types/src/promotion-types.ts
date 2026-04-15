// Promotion pipeline, audit, and emergency override types for Iteration 5

export type PromotionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "applied"
  | "expired";

export interface PromotionRequest {
  readonly id: string;
  readonly key: string;
  readonly fromValue: unknown;
  readonly toValue: unknown;
  readonly layer: string;
  readonly tenantId: string;
  readonly requestedBy: string;
  readonly requestedAt: string; // ISO timestamp
  readonly status: PromotionStatus;
  readonly changePolicy: string;
  readonly reason?: string | undefined;
  readonly reviewedBy?: string | undefined;
  readonly reviewedAt?: string | undefined;
}

export interface ConfigAuditEntry {
  readonly timestamp: string; // ISO
  readonly actor: string;
  readonly action:
    | "set"
    | "remove"
    | "install"
    | "uninstall"
    | "enable"
    | "disable"
    | "promote";
  readonly key: string;
  readonly layer: string;
  readonly tenantId?: string | undefined;
  readonly oldValue?: unknown | undefined;
  readonly newValue?: unknown | undefined;
  readonly changePolicy?: string | undefined;
  readonly isEmergencyOverride: boolean;
  readonly overrideReason?: string | undefined;
}

export interface EmergencyOverrideRecord {
  readonly id: string;
  readonly key: string;
  readonly actor: string;
  readonly reason: string;
  readonly tenantId: string;
  readonly layer: string;
  readonly createdAt: string; // ISO
  readonly followUpDeadline: string; // ISO (createdAt + 24h)
  readonly regularizedAt?: string | undefined;
  readonly regularizedBy?: string | undefined;
}
