import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryStorageProvider } from "./providers/index";
import { startWeaverServer } from "./server";

describe("Weaver server auth gate", () => {
  it("rejects unauthenticated writes when JWT auth is enabled", async () => {
    const server = await startWeaverServer({
      port: 0,
      jwtSecret: "test-secret",
      providers: [
        createInMemoryStorageProvider({ id: "test", layer: "platform" }),
      ],
    });

    try {
      const readResponse = await fetch(
        `http://localhost:${server.port}/v1/config/test/key`,
      );
      assert.equal(readResponse.status, 200);

      const writeResponse = await fetch(
        `http://localhost:${server.port}/v1/config/test/key`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: "blocked" }),
        },
      );

      assert.equal(writeResponse.status, 401);
    } finally {
      await server.close();
    }
  });
});
