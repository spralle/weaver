import { startWeaverServer } from "@weaver-conf/weaver-server";

describe("WeaverServer", () => {
  it("starts and reports isReady", async () => {
    const server = await startWeaverServer({ port: 0 });
    try {
      expect(server.port > 0).toBeTruthy();
      expect(server.isReady).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("close triggers shutdown", async () => {
    const server = await startWeaverServer({ port: 0 });
    await server.close();
    expect(server.isReady).toBe(false);
  });

  it("healthz endpoint responds", async () => {
    const server = await startWeaverServer({ port: 0 });
    try {
      const res = await fetch(`http://localhost:${server.port}/healthz`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
    } finally {
      await server.close();
    }
  });

  it("REST adapter is wired — GET /v1/config returns 200", async () => {
    const server = await startWeaverServer({ port: 0 });
    try {
      const res = await fetch(`http://localhost:${server.port}/v1/config`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data !== undefined).toBeTruthy();
      expect(body.meta !== undefined).toBeTruthy();
    } finally {
      await server.close();
    }
  });

  it("SSE adapter is wired — GET /v1/events returns event-stream", async () => {
    const server = await startWeaverServer({ port: 0 });
    try {
      const res = await fetch(`http://localhost:${server.port}/v1/events`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/event-stream");
    } finally {
      await server.close();
    }
  });

  it("unknown routes return 404", async () => {
    const server = await startWeaverServer({ port: 0 });
    try {
      const res = await fetch(`http://localhost:${server.port}/unknown`);
      expect(res.status).toBe(404);
    } finally {
      await server.close();
    }
  });
});
