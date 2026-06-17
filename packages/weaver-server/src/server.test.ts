import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createInMemoryStorageProvider } from "./providers/index";
import { startWeaverServer } from "./server";

async function createBootstrapRepo(): Promise<{
  readonly repoPath: string;
  readonly rootPath: string;
}> {
  const rootPath = await mkdtemp(join(tmpdir(), "weaver-bootstrap-"));
  const repoPath = join(rootPath, "repo");
  await mkdir(join(repoPath, "bootstrap"), { recursive: true });
  await writeFile(
    join(repoPath, "bootstrap", "server.json"),
    JSON.stringify({
      layers: [{ id: "platform", provider: "git", path: "platform.json" }],
    }),
  );
  await writeFile(
    join(repoPath, "platform.json"),
    JSON.stringify({ app: { name: "Bootstrapped Weaver" } }),
  );

  const { default: simpleGit } = await import("simple-git");
  const git = simpleGit(repoPath);
  await git.init(["--initial-branch=main"]);
  await git.addConfig("user.email", "weaver@example.test");
  await git.addConfig("user.name", "Weaver Test");
  await git.add(".");
  await git.commit("seed bootstrap config");

  return { repoPath, rootPath };
}

async function removeBootstrapClone(environment: string): Promise<void> {
  await rm(join(process.cwd(), ".weaver-config", environment), {
    force: true,
    recursive: true,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readEnvelopeValue(body: unknown): unknown {
  assert.ok(isRecord(body));
  assert.ok("data" in body);
  const data = body.data;
  assert.ok(isRecord(data));
  assert.ok("value" in data);
  return data.value;
}

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

describe("Weaver server bootstrap", () => {
  it("uses bootstrap providers from a configured Git repository", async () => {
    const { repoPath, rootPath } = await createBootstrapRepo();
    const environment = `test-${Date.now()}-bootstrap`;
    const server = await startWeaverServer({
      port: 0,
      repoUrl: repoPath,
      environment,
    });

    try {
      const response = await fetch(
        `http://localhost:${server.port}/v1/config/app/name`,
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(readEnvelopeValue(body), "Bootstrapped Weaver");
    } finally {
      await server.close();
      await removeBootstrapClone(environment);
      await rm(rootPath, { force: true, recursive: true });
    }
  });

  it("uses explicit providers instead of bootstrapping when both are supplied", async () => {
    const provider = createInMemoryStorageProvider({
      id: "explicit",
      layer: "platform",
      initialEntries: { app: { name: "Explicit Provider" } },
    });

    const server = await startWeaverServer({
      port: 0,
      repoUrl: join(tmpdir(), "missing-weaver-bootstrap-repo"),
      environment: `test-${Date.now()}-explicit`,
      providers: [provider],
    });

    try {
      const response = await fetch(
        `http://localhost:${server.port}/v1/config/app/name`,
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(readEnvelopeValue(body), "Explicit Provider");
    } finally {
      await server.close();
    }
  });

  it("keeps the in-memory fallback without repoUrl or providers", async () => {
    const server = await startWeaverServer({ port: 0 });

    try {
      const response = await fetch(
        `http://localhost:${server.port}/v1/config/app/name`,
      );

      assert.equal(response.status, 200);
      assert.equal(server.isReady, true);
    } finally {
      await server.close();
    }
  });
});
