import { test } from "bun:test";
import assert from "node:assert/strict";
import { createProviders } from "../../src/bootstrap/layer-factory.ts";
import { GitStorageProvider } from "../../src/storage/git-storage-provider.ts";
import { MongoDBStorageProvider } from "../../src/storage/mongodb-storage-provider.ts";
import { InMemoryStorageProvider } from "@weaver/config-providers";
import { createGitWriteQueue } from "../../src/git/write-queue.ts";

function createMockGit() {
  return {
    cwd() { return Promise.resolve(); },
    add() { return Promise.resolve(); },
    commit() { return Promise.resolve(); },
    pull() { return Promise.resolve(); },
    push() { return Promise.resolve(); },
  };
}

function createMockCollection() {
  return {
    find() { return { toArray: () => Promise.resolve([]) }; },
    async updateOne() {},
    async deleteOne() {},
  };
}

test("creates GitStorageProvider for 'git' layer", () => {
  const providers = createProviders(
    { layers: [{ id: "defaults", provider: "git", path: "defaults.json" }] },
    {
      gitManager: { localPath: "/tmp/repo", ensureClone: async () => {}, pull: async () => {} },
      writeQueue: createGitWriteQueue(),
      git: createMockGit(),
      environment: "prod",
    },
  );

  assert.equal(providers.length, 1);
  assert.ok(providers[0] instanceof GitStorageProvider);
});

test("creates MongoDBStorageProvider for 'mongodb' layer", () => {
  const providers = createProviders(
    { layers: [{ id: "user", provider: "mongodb" }], mongodb: { uri: "mongodb://localhost" } },
    {
      gitManager: { localPath: "/tmp/repo", ensureClone: async () => {}, pull: async () => {} },
      writeQueue: createGitWriteQueue(),
      git: createMockGit(),
      mongoCollection: createMockCollection(),
      environment: "prod",
    },
  );

  assert.equal(providers.length, 1);
  assert.ok(providers[0] instanceof MongoDBStorageProvider);
});

test("creates InMemoryStorageProvider for 'memory' layer", () => {
  const providers = createProviders(
    { layers: [{ id: "session", provider: "memory" }] },
    {
      gitManager: { localPath: "/tmp/repo", ensureClone: async () => {}, pull: async () => {} },
      writeQueue: createGitWriteQueue(),
      git: createMockGit(),
      environment: "prod",
    },
  );

  assert.equal(providers.length, 1);
  assert.ok(providers[0] instanceof InMemoryStorageProvider);
});

test("throws when mongodb layer has no collection", () => {
  assert.throws(
    () => createProviders(
      { layers: [{ id: "user", provider: "mongodb" }], mongodb: { uri: "x" } },
      {
        gitManager: { localPath: "/tmp/repo", ensureClone: async () => {}, pull: async () => {} },
        writeQueue: createGitWriteQueue(),
        git: createMockGit(),
        environment: "prod",
      },
    ),
    { message: 'MongoDB collection required for layer "user"' },
  );
});
