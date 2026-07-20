import { createInMemoryStorageProvider } from "@weaver-conf/storage-providers";
import { createWeaverConfigService } from "../src/core/config-service.js";

describe("WeaverConfigService", () => {
  async function makeService(entries: Record<string, unknown> = {}) {
    const provider = createInMemoryStorageProvider({
      id: "mem-app",
      layer: "app",
      initialEntries: entries,
    });
    return createWeaverConfigService({
      providers: [provider],
      environment: "test",
    });
  }

  it("resolves all entries", async () => {
    const svc = await makeService({ "app.name": "weaver", "app.port": 8080 });
    const snapshot = await svc.resolveAll();
    expect(snapshot.entries["app.name"]).toBe("weaver");
    expect(snapshot.entries["app.port"]).toBe(8080);
    expect(snapshot.revision).toBeTruthy();
  });

  it("gets a single key", async () => {
    const svc = await makeService({ db: { host: "localhost" } });
    const val = await svc.get("db.host");
    expect(val).toBe("localhost");
  });

  it("returns undefined for missing key", async () => {
    const svc = await makeService({});
    const val = await svc.get("missing.key");
    expect(val).toBe(undefined);
  });

  it("sets a value and updates revision", async () => {
    const svc = await makeService({});
    const oldRev = svc.revision;
    const result = await svc.set("app", "new.key", "value");
    expect(result.success).toBe(true);
    const val = await svc.get("new.key");
    expect(val).toBe("value");
    expect(svc.revision).not.toBe(oldRev);
  });

  it("removes a value", async () => {
    const svc = await makeService({ "rm.key": "gone" });
    const result = await svc.remove("app", "rm.key");
    expect(result.success).toBe(true);
    const val = await svc.get("rm.key");
    expect(val).toBe(undefined);
  });

  it("fires delta on set", async () => {
    const svc = await makeService({});
    const deltas: unknown[] = [];
    svc.onDelta((d) => deltas.push(d));
    await svc.set("app", "x", 1);
    expect(deltas.length).toBe(1);
  });

  it("rejects write with stale revision", async () => {
    const svc = await makeService({});
    const result = await svc.set("app", "k", "v", {
      expectedRevision: "stale-rev",
    });
    expect(result.success).toBe(false);
  });

  it("handles degraded providers gracefully", async () => {
    const badProvider = {
      id: "bad",
      layer: "core",
      writable: false as const,
      async load() {
        throw new Error("connection failed");
      },
    };
    const goodProvider = createInMemoryStorageProvider({
      id: "good",
      layer: "app",
      initialEntries: { k: "v" },
    });
    const svc = await createWeaverConfigService({
      providers: [badProvider, goodProvider],
      environment: "test",
    });
    expect(svc.degradedProviders).toEqual(["bad"]);
    const val = await svc.get("k");
    expect(val).toBe("v");
  });

  it("getNamespace returns nested object at prefix", async () => {
    const svc = await makeService({
      app: { name: "w", port: 3000 },
      db: { host: "x" },
    });
    const ns = await svc.getNamespace("app");
    expect(ns.name).toBe("w");
    expect(ns.port).toBe(3000);
  });
});
