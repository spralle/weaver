import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapConfigSchema } from "../../src/types/bootstrap.ts";

test("bootstrapConfigSchema validates valid config", () => {
  const result = bootstrapConfigSchema.safeParse({
    layers: [
      { id: "base", provider: "git", path: "./config" },
      { id: "overrides", provider: "mongodb", collection: "configs" },
    ],
    mongodb: { uri: "mongodb://localhost:27017" },
  });
  assert.equal(result.success, true);
});

test("bootstrapConfigSchema rejects when mongodb layer present but no mongodb config", () => {
  const result = bootstrapConfigSchema.safeParse({
    layers: [
      { id: "overrides", provider: "mongodb", collection: "configs" },
    ],
  });
  assert.equal(result.success, false);
});

test("bootstrapConfigSchema allows no mongodb config when no mongodb layers", () => {
  const result = bootstrapConfigSchema.safeParse({
    layers: [
      { id: "base", provider: "git", path: "./config" },
      { id: "mem", provider: "memory" },
    ],
  });
  assert.equal(result.success, true);
});
