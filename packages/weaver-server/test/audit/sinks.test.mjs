import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createStdoutAuditSink, createMongoAuditSink } from "@weaver-conf/weaver-server";

function makeEntry() {
  return {
    timestamp: "2026-01-01T00:00:00Z",
    actor: "user1",
    action: "set",
    key: "app.feature",
    layer: "service",
    environment: "production",
    isEmergencyOverride: false,
  };
}

describe("StdoutAuditSink", () => {
  it("outputs JSON to stdout", async () => {
    const sink = createStdoutAuditSink();
    const written = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = (chunk) => { written.push(chunk); return true; };

    try {
      await sink.record(makeEntry());
      assert.equal(written.length, 1);
      const parsed = JSON.parse(written[0].trim());
      assert.equal(parsed.actor, "user1");
    } finally {
      process.stdout.write = originalWrite;
    }
  });
});

describe("MongoAuditSink", () => {
  it("inserts document into collection", async () => {
    const inserted = [];
    const collection = { insertOne: async (doc) => inserted.push(doc) };
    const sink = createMongoAuditSink({ collection });

    await sink.record(makeEntry());

    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].actor, "user1");
  });
});
