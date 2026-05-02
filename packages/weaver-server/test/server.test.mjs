import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { startWeaverServer } from "@weaver/weaver-server";

describe("WeaverServer", () => {
  it("starts and reports isReady", async () => {
    const server = await startWeaverServer({ port: 0 });
    try {
      assert.ok(server.port > 0);
      assert.equal(server.isReady, true);
    } finally {
      await server.close();
    }
  });

  it("close triggers shutdown", async () => {
    const server = await startWeaverServer({ port: 0 });
    await server.close();
    assert.equal(server.isReady, false);
  });

  it("healthz endpoint responds", async () => {
    const server = await startWeaverServer({ port: 0 });
    try {
      const res = await fetch(`http://localhost:${server.port}/healthz`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, "ok");
    } finally {
      await server.close();
    }
  });
});
