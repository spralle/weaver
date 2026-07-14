import { createSessionManager } from "@weaver-conf/weaver-server";

function mockAuditService() {
  const entries = [];
  return {
    entries,
    async record(entry) { entries.push(entry); },
  };
}

function mockConfigService() {
  return { resolveAll: async () => ({}), get: async () => undefined };
}

describe("SessionManager", () => {
  it("activate creates session", async () => {
    const audit = mockAuditService();
    const mgr = createSessionManager({ configService: mockConfigService(), auditService: audit });

    const session = await mgr.activate({ reason: "hotfix", activatedBy: "admin" });

    expect(session.id).toBeTruthy();
    expect(session.activatedBy).toBe("admin");
    expect(session.reason).toBe("hotfix");
    expect(session.expiresAt).toBeTruthy();
    expect(audit.entries.length).toBe(1);
  });

  it("deactivate removes session", async () => {
    const audit = mockAuditService();
    const mgr = createSessionManager({ configService: mockConfigService(), auditService: audit });

    const session = await mgr.activate({ reason: "test", activatedBy: "admin" });
    await mgr.deactivate(session.id, "admin");

    expect(mgr.getSession(session.id)).toBe(undefined);
  });

  it("setOverride records audit with isEmergencyOverride", async () => {
    const audit = mockAuditService();
    const mgr = createSessionManager({ configService: mockConfigService(), auditService: audit });

    const session = await mgr.activate({ reason: "test", activatedBy: "admin" });
    await mgr.setOverride(session.id, "key1", "val1", "admin");

    const overrideEntry = audit.entries.find((e) => e.key === "key1");
    expect(overrideEntry).toBeTruthy();
    expect(overrideEntry.isEmergencyOverride).toBe(true);
  });

  it("getSession returns session info", async () => {
    const audit = mockAuditService();
    const mgr = createSessionManager({ configService: mockConfigService(), auditService: audit });

    const session = await mgr.activate({ reason: "test", activatedBy: "admin" });
    const found = mgr.getSession(session.id);

    expect(found).toEqual(session);
  });

  it("listActiveSessions excludes expired", async () => {
    const audit = mockAuditService();
    const mgr = createSessionManager({ configService: mockConfigService(), auditService: audit });

    // Create session with 0 duration (already expired)
    const session = await mgr.activate({ reason: "test", activatedBy: "admin", duration: 0 });

    // Wait a tick for expiry
    await new Promise((r) => setTimeout(r, 5));
    const active = mgr.listActiveSessions();

    expect(active.length).toBe(0);
  });

  it("follow-up deadline is 24h after activation", async () => {
    const audit = mockAuditService();
    const mgr = createSessionManager({ configService: mockConfigService(), auditService: audit });

    const session = await mgr.activate({ reason: "test", activatedBy: "admin" });
    const activatedAt = new Date(session.activatedAt).getTime();
    const deadline = new Date(session.followUpDeadline).getTime();

    expect(deadline - activatedAt).toBe(24 * 60 * 60_000);
    mgr.dispose();
  });

  it("sweep timer removes expired sessions", async () => {
    const audit = mockAuditService();
    const mgr = createSessionManager({
      configService: mockConfigService(),
      auditService: audit,
      sweepIntervalMs: 20,
    });

    // Create session with 0 duration (already expired)
    await mgr.activate({ reason: "test", activatedBy: "admin", duration: 0 });
    // Create a valid session
    const valid = await mgr.activate({ reason: "keep", activatedBy: "admin", duration: 60 });

    // Wait for sweep to fire
    await new Promise((r) => setTimeout(r, 50));

    // Expired session swept, valid session remains
    const active = mgr.listActiveSessions();
    expect(active.length).toBe(1);
    expect(active[0].id).toBe(valid.id);
    mgr.dispose();
  });

  it("dispose clears sweep timer", () => {
    const audit = mockAuditService();
    const mgr = createSessionManager({
      configService: mockConfigService(),
      auditService: audit,
      sweepIntervalMs: 10,
    });
    // Should not throw
    mgr.dispose();
    mgr.dispose(); // idempotent
  });
});
