import { configSnapshotSchema } from "@weaver-conf/config-types";

test("configSnapshotSchema validates valid snapshot", () => {
  const result = configSnapshotSchema.safeParse({
    entries: { "app.theme": "light" },
    scopes: {},
    revision: "abc123",
    timestamp: "2026-05-01T00:00:00Z",
  });
  expect(result.success).toBe(true);
});

test("configSnapshotSchema validates snapshot with scopes", () => {
  const result = configSnapshotSchema.safeParse({
    entries: {},
    scopes: {
      "tenant:acme": { "app.theme": "dark" },
      "tenant:globex": { "app.logo": "logo.png" },
    },
    revision: "def456",
    timestamp: "2026-05-01T00:00:00Z",
  });
  expect(result.success).toBe(true);
});

test("configSnapshotSchema allows optional timestamp", () => {
  const result = configSnapshotSchema.safeParse({
    entries: {},
    scopes: {},
    revision: "rev1",
  });
  expect(result.success).toBe(true);
});
