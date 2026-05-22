import { configDeltaSchema } from "@weaver-conf/config-types";
import { z } from "zod";

export const sseSnapshotEventSchema = z.object({
  entries: z.record(z.string(), z.unknown()),
  revision: z.string(),
});
export type SSESnapshotEvent = z.infer<typeof sseSnapshotEventSchema>;

export const sseChangeEventSchema = configDeltaSchema.extend({
  revision: z.string(),
});
export type SSEChangeEvent = z.infer<typeof sseChangeEventSchema>;

export const sseCheckpointEventSchema = z.object({
  revision: z.string(),
});
export type SSECheckpointEvent = z.infer<typeof sseCheckpointEventSchema>;

export type SSEEventType = "snapshot" | "change" | "checkpoint";

export interface SSEMessage {
  event: SSEEventType;
  data: SSESnapshotEvent | SSEChangeEvent | SSECheckpointEvent;
}

export function formatSSEMessage(msg: SSEMessage): string {
  return `event: ${msg.event}\ndata: ${JSON.stringify(msg.data)}\n\n`;
}
