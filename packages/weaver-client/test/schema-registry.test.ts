import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createClientSchemaRegistry } from "../src/schema-registry.js";
import type { ConfigurationPropertySchema } from "@weaver-conf/config-types";

describe("ClientSchemaRegistry", () => {
  it("getSchema returns undefined for unknown key", () => {
    const reg = createClientSchemaRegistry();
    assert.equal(reg.getSchema("unknown.key"), undefined);
  });

  it("getSchema returns schema after load", () => {
    const reg = createClientSchemaRegistry();
    const schema: ConfigurationPropertySchema = { type: "string" };
    reg.load({ "app.name": schema });
    assert.deepEqual(reg.getSchema("app.name"), schema);
  });

  it("isSensitive returns true when x-weaver.sensitive is true", () => {
    const reg = createClientSchemaRegistry();
    reg.load({
      "db.password": {
        type: "string",
        "x-weaver": { sensitive: true },
      },
    });
    assert.equal(reg.isSensitive("db.password"), true);
  });

  it("isSensitive returns false when not set", () => {
    const reg = createClientSchemaRegistry();
    reg.load({ "app.name": { type: "string" } });
    assert.equal(reg.isSensitive("app.name"), false);
  });

  it("getRestartRequiredKeys returns correct keys", () => {
    const reg = createClientSchemaRegistry();
    reg.load({
      "app.port": {
        type: "integer",
        "x-weaver": { reloadBehavior: "restart-required" },
      },
      "app.name": {
        type: "string",
        "x-weaver": { reloadBehavior: "hot" },
      },
      "app.workers": {
        type: "integer",
        "x-weaver": { reloadBehavior: "restart-required" },
      },
    });
    const keys = reg.getRestartRequiredKeys();
    assert.deepEqual([...keys].sort(), ["app.port", "app.workers"]);
  });

  it("validate — valid string passes", () => {
    const reg = createClientSchemaRegistry();
    reg.load({ "app.name": { type: "string", minLength: 1 } });
    assert.deepEqual(reg.validate("app.name", "hello"), { valid: true });
  });

  it("validate — wrong type fails", () => {
    const reg = createClientSchemaRegistry();
    reg.load({ "app.name": { type: "string" } });
    const result = reg.validate("app.name", 42);
    assert.equal(result.valid, false);
    assert.ok(result.errors && result.errors.length > 0);
  });

  it("validate — enum constraint works", () => {
    const reg = createClientSchemaRegistry();
    reg.load({ "app.env": { type: "string", enum: ["dev", "prod"] } });
    assert.equal(reg.validate("app.env", "dev").valid, true);
    assert.equal(reg.validate("app.env", "staging").valid, false);
  });

  it("validate — number min/max works", () => {
    const reg = createClientSchemaRegistry();
    reg.load({ "app.port": { type: "integer", minimum: 1, maximum: 65535 } });
    assert.equal(reg.validate("app.port", 8080).valid, true);
    assert.equal(reg.validate("app.port", 0).valid, false);
    assert.equal(reg.validate("app.port", 70000).valid, false);
  });

  it("validate — unknown key returns valid", () => {
    const reg = createClientSchemaRegistry();
    assert.deepEqual(reg.validate("no.schema", "anything"), { valid: true });
  });

  it("validate — pattern constraint works", () => {
    const reg = createClientSchemaRegistry();
    reg.load({ "app.id": { type: "string", pattern: "^[a-z]+$" } });
    assert.equal(reg.validate("app.id", "hello").valid, true);
    assert.equal(reg.validate("app.id", "Hello123").valid, false);
  });
});
