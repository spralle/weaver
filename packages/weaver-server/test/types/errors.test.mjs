import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  createWeaverError,
  weaverErrorSchema,
  httpStatusForError,
  weaverErrorCodes,
  HTTP_STATUS_MAP,
} from "../../src/types/errors.ts";

test("createWeaverError returns correct structure", () => {
  const err = createWeaverError("NOT_FOUND", "key missing", { key: "foo" });
  assert.equal(err.code, "NOT_FOUND");
  assert.equal(err.message, "key missing");
  assert.deepEqual(err.details, { key: "foo" });
});

test("createWeaverError omits details when not provided", () => {
  const err = createWeaverError("UNAUTHORIZED", "bad token");
  assert.equal(err.code, "UNAUTHORIZED");
  assert.equal(err.message, "bad token");
  assert.equal(err.details, undefined);
});

test("weaverErrorSchema validates correctly", () => {
  const result = weaverErrorSchema.safeParse({
    code: "FORBIDDEN",
    message: "denied",
  });
  assert.equal(result.success, true);
});

test("weaverErrorSchema rejects invalid code", () => {
  const result = weaverErrorSchema.safeParse({
    code: "INVALID_CODE",
    message: "test",
  });
  assert.equal(result.success, false);
});

test("error codes include SCOPE_NOT_FOUND and SCOPE_NOT_LOADED", () => {
  assert.ok(weaverErrorCodes.includes("SCOPE_NOT_FOUND"));
  assert.ok(weaverErrorCodes.includes("SCOPE_NOT_LOADED"));
});

test("httpStatusForError returns correct status for each code", () => {
  for (const code of weaverErrorCodes) {
    const status = httpStatusForError(code);
    assert.equal(status, HTTP_STATUS_MAP[code]);
    assert.equal(typeof status, "number");
  }
});
