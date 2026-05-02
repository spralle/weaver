import { test } from "bun:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bootstrap } from "../../src/bootstrap/bootstrap-loader.ts";

function createMockGit(localPath) {
  return {
    cwd() { return Promise.resolve(); },
    clone() { return Promise.resolve(); },
    add() { return Promise.resolve(); },
    commit() { return Promise.resolve(); },
    pull() { return Promise.resolve(); },
    push() { return Promise.resolve(); },
  };
}

test("bootstrap creates providers from config file", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "bootstrap-"));
  // Simulate a cloned repo with bootstrap/server.json
  await mkdir(join(tmp, ".weaver-config", "test", ".git"), { recursive: true });
  await mkdir(join(tmp, ".weaver-config", "test", "bootstrap"), { recursive: true });
  await writeFile(
    join(tmp, ".weaver-config", "test", "bootstrap", "server.json"),
    JSON.stringify({
      layers: [
        { id: "defaults", provider: "memory" },
      ],
    }),
  );

  // Override cwd so localPath resolves to our temp
  const origCwd = process.cwd;
  process.cwd = () => tmp;

  try {
    const result = await bootstrap({
      repoUrl: "https://github.com/test/repo.git",
      environment: "test",
      git: createMockGit(),
    });

    assert.equal(result.providers.length, 1);
    assert.equal(result.environment, "test");
  } finally {
    process.cwd = origCwd;
  }
});

test("bootstrap throws on invalid config", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "bootstrap-"));
  await mkdir(join(tmp, ".weaver-config", "test", ".git"), { recursive: true });
  await mkdir(join(tmp, ".weaver-config", "test", "bootstrap"), { recursive: true });
  await writeFile(
    join(tmp, ".weaver-config", "test", "bootstrap", "server.json"),
    JSON.stringify({ layers: "invalid" }),
  );

  const origCwd = process.cwd;
  process.cwd = () => tmp;

  try {
    await assert.rejects(
      bootstrap({
        repoUrl: "https://github.com/test/repo.git",
        environment: "test",
        git: createMockGit(),
      }),
    );
  } finally {
    process.cwd = origCwd;
  }
});
