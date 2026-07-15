
import {
  syncQueueMetadataSchema,
} from "../src";

test("syncQueueMetadataSchema accepts queue counters", () => {
  const result = syncQueueMetadataSchema.safeParse({
    pendingCount: 3,
    inFlightCount: 1,
    oldestQueuedAt: 1713123400000,
    newestQueuedAt: 1713123450000,
  });

  expect(result.success).toBe(true);
});
