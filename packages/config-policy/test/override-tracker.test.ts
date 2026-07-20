import { createInMemoryOverrideTracker } from "../src/memory-override-tracker.js";

describe("InMemoryOverrideTracker", () => {
  it("creates a record with computed deadline", async () => {
    const tracker = createInMemoryOverrideTracker({
      followUpDeadlineMs: 60_000,
    });
    const record = await tracker.create({
      id: "ov-1",
      sessionId: "s1",
      key: "feature.flag",
      layer: "session",
      previousValue: false,
      newValue: true,
      reason: "hotfix",
      createdAt: "2025-01-01T00:00:00.000Z",
      createdBy: "admin",
    });
    expect(record.id).toBe("ov-1");
    expect(record.followUpDeadline).toBe("2025-01-01T00:01:00.000Z");
  });

  it("lists active records (not regularized)", async () => {
    const tracker = createInMemoryOverrideTracker();
    await tracker.create({
      id: "ov-1",
      sessionId: "s1",
      key: "k",
      layer: "session",
      previousValue: null,
      newValue: true,
      reason: "r",
      createdAt: "2025-01-01T00:00:00.000Z",
      createdBy: "admin",
    });
    const active = await tracker.listActive();
    expect(active.length).toBe(1);
  });

  it("regularize marks record and removes from active", async () => {
    const tracker = createInMemoryOverrideTracker();
    await tracker.create({
      id: "ov-1",
      sessionId: "s1",
      key: "k",
      layer: "session",
      previousValue: null,
      newValue: true,
      reason: "r",
      createdAt: "2025-01-01T00:00:00.000Z",
      createdBy: "admin",
    });
    const result = await tracker.regularize("ov-1", "ops");
    expect(result).toBeTruthy();
    expect(result.regularizedAt).toBeTruthy();
    expect(result.regularizedBy).toBe("ops");
    const active = await tracker.listActive();
    expect(active.length).toBe(0);
  });

  it("regularize returns undefined for unknown id", async () => {
    const tracker = createInMemoryOverrideTracker();
    const result = await tracker.regularize("nope", "ops");
    expect(result).toBe(undefined);
  });

  it("listOverdue returns records past deadline", async () => {
    const tracker = createInMemoryOverrideTracker({ followUpDeadlineMs: 1000 });
    await tracker.create({
      id: "ov-1",
      sessionId: "s1",
      key: "k",
      layer: "session",
      previousValue: null,
      newValue: true,
      reason: "r",
      createdAt: "2020-01-01T00:00:00.000Z",
      createdBy: "admin",
    });
    const overdue = await tracker.listOverdue("2025-01-01T00:00:00.000Z");
    expect(overdue.length).toBe(1);
  });
});
