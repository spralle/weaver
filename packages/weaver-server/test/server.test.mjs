import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { startWeaverServer } from "@weaver-conf/weaver-server";

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

  it("REST adapter is wired — GET /v1/config returns 200", async () => {
    const server = await startWeaverServer({ port: 0 });
    try {
      const res = await fetch(`http://localhost:${server.port}/v1/config`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.data !== undefined);
      assert.ok(body.meta !== undefined);
    } finally {
      await server.close();
    }
  });

  it("SSE adapter is wired — GET /v1/events returns event-stream", async () => {
    const server = await startWeaverServer({ port: 0 });
    try {
      const res = await fetch(`http://localhost:${server.port}/v1/events`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "text/event-stream");
    } finally {
      await server.close();
    }
  });

  it("unknown routes return 404", async () => {
    const server = await startWeaverServer({ port: 0 });
    try {
      const res = await fetch(`http://localhost:${server.port}/unknown`);
      assert.equal(res.status, 404);
    } finally {
      await server.close();
    }
  });
});
