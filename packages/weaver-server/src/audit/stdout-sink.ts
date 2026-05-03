// Stdout audit sink — writes JSON-serialized entries one per line
import type { ConfigAuditSink, AuditEntry } from "./audit-service.js";

export function createStdoutAuditSink(): ConfigAuditSink {
  return {
    async record(entry: AuditEntry): Promise<void> {
      process.stdout.write(JSON.stringify(entry) + "\n");
    },
  };
}
