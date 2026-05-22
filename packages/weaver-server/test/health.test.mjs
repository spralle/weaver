import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHealthEndpoints } from "@weaver-conf/weaver-server";

describe("HealthEndpoints", () => {
  it("healthz returns 200 always", () => {
    const health = createHealthEndpoints();
    const result = health.healthz();
    assert.equal(result.status, 200);
    assert.equal(result.body.status, "ok");
  });

  it("readyz returns 503 before setReady", () => {
    const health = createHealthEndpoints();
    const result = health.readyz();
    assert.equal(result.status, 503);
    assert.equal(result.body.status, "starting");
  });

  it("readyz returns 200 after setReady", () => {
    const health = createHealthEndpoints();
    health.setReady(true);
    const result = health.readyz();
    assert.equal(result.status, 200);
    assert.equal(result.body.status, "ok");
  });

  it("setReady(false) returns 503 again", () => {
    const health = createHealthEndpoints();
    health.setReady(true);
    health.setReady(false);
    const result = health.readyz();
    assert.equal(result.status, 503);
  });
});
