import test from "node:test";
import assert from "node:assert/strict";

import {
  syncQueueMetadataSchema,
} from "../dist/index.js";

test("syncQueueMetadataSchema accepts queue counters", () => {
  const result = syncQueueMetadataSchema.safeParse({
    pendingCount: 3,
    inFlightCount: 1,
    oldestQueuedAt: 1713123400000,
    newestQueuedAt: 1713123450000,
  });

  assert.equal(result.success, true);
});
