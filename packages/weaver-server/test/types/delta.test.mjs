import { configDeltaSchema } from "@weaver-conf/config-types";

test("configDeltaSchema validates set delta", () => {
  const result = configDeltaSchema.safeParse({
    action: "set",
    key: "app.theme",
    value: "dark",
    layer: "tenant",
    environment: "production",
    timestamp: "2026-05-01T00:00:00Z",
  });
  expect(result.success).toBe(true);
});

test("configDeltaSchema validates remove delta with null value", () => {
  const result = configDeltaSchema.safeParse({
    action: "remove",
    key: "app.theme",
    value: null,
    layer: "tenant",
    environment: "production",
    timestamp: "2026-05-01T00:00:00Z",
  });
  expect(result.success).toBe(true);
});

test("configDeltaSchema rejects invalid action", () => {
  const result = configDeltaSchema.safeParse({
    action: "update",
    key: "app.theme",
    value: "dark",
    layer: "tenant",
    environment: "production",
    timestamp: "2026-05-01T00:00:00Z",
  });
  expect(result.success).toBe(false);
});
