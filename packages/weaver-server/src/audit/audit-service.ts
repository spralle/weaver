// Audit service with pluggable sinks and sensitive value masking

export interface AuditEntry {
  timestamp: string;
  actor: string;
  action: "set" | "remove" | "promote" | "rollback" | "override" | "provision";
  key: string;
  layer: string;
  environment: string;
  tenantId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  isEmergencyOverride: boolean;
  metadata?: Record<string, unknown>;
}

export interface ConfigAuditSink {
  record(entry: AuditEntry): Promise<void>;
}

export interface AuditServiceOptions {
  sinks: ConfigAuditSink[];
  sensitiveKeys?: Set<string>;
}

export interface AuditService {
  record(entry: AuditEntry): Promise<void>;
}

export function createAuditService(options: AuditServiceOptions): AuditService {
  const { sinks, sensitiveKeys } = options;

  function maskEntry(entry: AuditEntry): AuditEntry {
    if (!sensitiveKeys || !sensitiveKeys.has(entry.key)) {
      return entry;
    }
    return {
      ...entry,
      oldValue: entry.oldValue !== undefined ? "***" : undefined,
      newValue: entry.newValue !== undefined ? "***" : undefined,
    };
  }

  return {
    async record(entry: AuditEntry): Promise<void> {
      const masked = maskEntry(entry);
      const results = await Promise.allSettled(
        sinks.map((sink) => sink.record(masked)),
      );
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("[audit] sink failed:", result.reason);
        }
      }
    },
  };
}
