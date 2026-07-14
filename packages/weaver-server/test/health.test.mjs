import { createHealthEndpoints } from "@weaver-conf/weaver-server";

describe("HealthEndpoints", () => {
  it("healthz returns 200 always", () => {
    const health = createHealthEndpoints();
    const result = health.healthz();
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ok");
  });

  it("readyz returns 503 before setReady", () => {
    const health = createHealthEndpoints();
    const result = health.readyz();
    expect(result.status).toBe(503);
    expect(result.body.status).toBe("starting");
  });

  it("readyz returns 200 after setReady", () => {
    const health = createHealthEndpoints();
    health.setReady(true);
    const result = health.readyz();
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ok");
  });

  it("setReady(false) returns 503 again", () => {
    const health = createHealthEndpoints();
    health.setReady(true);
    health.setReady(false);
    const result = health.readyz();
    expect(result.status).toBe(503);
  });
});
