import { matchGlob } from "../../src/transport/glob-matcher.ts";

describe("matchGlob", () => {
  test("exact match", () => {
    expect(matchGlob("app.name", "app.name")).toBe(true);
    expect(matchGlob("app.name", "app.port")).toBe(false);
  });

  test("* wildcard matches single segment chars", () => {
    expect(matchGlob("app.*", "app.name")).toBe(true);
    expect(matchGlob("app.*", "app.port")).toBe(true);
    expect(matchGlob("app.*", "db.host")).toBe(false);
    expect(matchGlob("*.name", "app.name")).toBe(true);
  });

  test("** matches nested paths", () => {
    expect(matchGlob("**", "app.name")).toBe(true);
    expect(matchGlob("**", "a.b.c.d")).toBe(true);
    expect(matchGlob("app.**", "app.db.host")).toBe(true);
  });

  test("no match", () => {
    expect(matchGlob("app.name", "db.host")).toBe(false);
    expect(matchGlob("app.*", "db.host")).toBe(false);
  });
});
