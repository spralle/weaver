// Stdout audit sink — writes JSON-serialized entries one per line
import type { ConfigAuditSink, SinkDomainAuditEntry } from "./types";

export function createStdoutAuditSink(): ConfigAuditSink {
  return {
    async record(entry: SinkDomainAuditEntry): Promise<void> {
      process.stdout.write(JSON.stringify(entry) + "\n");
    },
  };
}
