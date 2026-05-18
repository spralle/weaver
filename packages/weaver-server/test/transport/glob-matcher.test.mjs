import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { matchGlob } from "../../src/transport/glob-matcher.ts";

describe("matchGlob", () => {
  test("exact match", () => {
    assert.equal(matchGlob("app.name", "app.name"), true);
    assert.equal(matchGlob("app.name", "app.port"), false);
  });

  test("* wildcard matches single segment chars", () => {
    assert.equal(matchGlob("app.*", "app.name"), true);
    assert.equal(matchGlob("app.*", "app.port"), true);
    assert.equal(matchGlob("app.*", "db.host"), false);
    assert.equal(matchGlob("*.name", "app.name"), true);
  });

  test("** matches nested paths", () => {
    assert.equal(matchGlob("**", "app.name"), true);
    assert.equal(matchGlob("**", "a.b.c.d"), true);
    assert.equal(matchGlob("app.**", "app.db.host"), true);
  });

  test("no match", () => {
    assert.equal(matchGlob("app.name", "db.host"), false);
    assert.equal(matchGlob("app.*", "db.host"), false);
  });
});
