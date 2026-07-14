import {
  createPersistentSchemaRegistry,
  createSchemaRegistry,
} from "../../src/core/schema-registry.ts";
import { createWeaverConfigService } from "../../src/core/config-service.ts";

function deepSet(target, path, value) {
  const parts = path.split(".");
  let current = target;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    current[part] = current[part] ?? {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function createTestProvider(id, layer, entries) {
  let data = { ...entries };
  return {
    id,
    layer,
    writable: true,
    async load() { return { entries: { ...data } }; },
    async write(key, value) { deepSet(data, key, value); return { success: true }; },
    async remove(key) { delete data[key]; return { success: true }; },
  };
}

function createFailingProvider(id, layer) {
  return {
    id,
    layer,
    writable: true,
    async load() { return { entries: {} }; },
    async write() {
      return { success: false, error: { code: "INTERNAL_ERROR", message: "nope" } };
    },
    async remove() { return { success: true }; },
  };
}

function makeOptions() {
  const provider = createTestProvider("p1", "platform", {});
  return createWeaverConfigService({
    providers: [provider],
    environment: "dev",
  }).then((configService) => ({
    configService,
  }));
}

describe("SchemaRegistry", () => {
  test("register new schema succeeds with isNewSchema true", async () => {
    const opts = await makeOptions();
    const registry = createSchemaRegistry(opts);

    const result = await registry.register({
      serviceId: "my-service",
      declaration: { type: "object", properties: { port: { type: "number", default: 3000 } } },
      environment: "dev",
    });

    expect(result.success).toBe(true);
    expect(result.isNewSchema).toBe(true);
    expect(result.hasBreakingChanges).toBe(false);
  });

  test("register unchanged schema is idempotent", async () => {
    const opts = await makeOptions();
    const registry = createSchemaRegistry(opts);
    const declaration = { type: "object", properties: { port: { type: "number" } } };

    await registry.register({ serviceId: "svc", declaration, environment: "dev" });
    const result = await registry.register({ serviceId: "svc", declaration, environment: "dev" });

    expect(result.success).toBe(true);
    expect(result.isNewSchema).toBe(false);
    expect(result.hasBreakingChanges).toBe(false);
  });

  test("register with removed property detects breaking change", async () => {
    const opts = await makeOptions();
    const registry = createSchemaRegistry(opts);

    await registry.register({
      serviceId: "svc",
      declaration: { type: "object", properties: { port: { type: "number" }, host: { type: "string" } } },
      environment: "dev",
    });

    const result = await registry.register({
      serviceId: "svc",
      declaration: { type: "object", properties: { port: { type: "number" } } },
      environment: "dev",
    });

    expect(result.success).toBe(true);
    expect(result.hasBreakingChanges).toBe(true);
    expect(result.breakingChanges?.some((c) => c.includes("host"))).toBeTruthy();
  });

  test("getSchema returns registered schema", async () => {
    const opts = await makeOptions();
    const registry = createSchemaRegistry(opts);
    const declaration = { type: "object", properties: { key: { type: "string" } } };

    await registry.register({ serviceId: "svc", declaration, environment: "dev" });
    const schema = await registry.getSchema("svc", "dev");

    expect(schema).toEqual(declaration);
  });

  test("getSchema returns null for unknown service", async () => {
    const opts = await makeOptions();
    const registry = createSchemaRegistry(opts);

    const schema = await registry.getSchema("unknown", "dev");
    expect(schema).toBe(null);
  });

  test("persistent registry writes schemas into configured layer and key", async () => {
    const provider = createTestProvider("p1", "custom", {});
    const configService = await createWeaverConfigService({
      providers: [provider],
      environment: "dev",
    });
    const registry = await createPersistentSchemaRegistry({
      configService,
      layer: "custom",
      key: "registry.schemas",
    });

    const result = await registry.register({
      serviceId: "billing",
      declaration: { type: "object", properties: { enabled: { type: "boolean" } } },
      environment: "dev",
    });

    expect(result.success).toBe(true);
    expect(await configService.get("registry.schemas")).toEqual({
      billing: {
        dev: { type: "object", properties: { enabled: { type: "boolean" } } },
      },
    });
  });

  test("persistent registry hydrates schemas after restart", async () => {
    const entries = {
      _weaver: {
        schemas: {
          billing: {
            dev: { type: "object", properties: { limit: { type: "number" } } },
          },
        },
      },
    };
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", entries)],
      environment: "dev",
    });

    const registry = await createPersistentSchemaRegistry({ configService });

    expect(await registry.getSchema("billing", "dev")).toEqual({
      type: "object",
      properties: { limit: { type: "number" } },
    });
  });

  test("listAll includes hydrated persistent schemas", async () => {
    const configService = await createWeaverConfigService({
      providers: [
        createTestProvider("p1", "platform", {
          _weaver: { schemas: { svc: { prod: { type: "string" } } } },
        }),
      ],
      environment: "prod",
    });

    const registry = await createPersistentSchemaRegistry({ configService });

    expect(registry.listAll()).toEqual({ "svc:prod": { type: "string" } });
  });

  test("persistent registry throws for invalid persisted root", async () => {
    const configService = await createWeaverConfigService({
      providers: [createTestProvider("p1", "platform", { _weaver: { schemas: [] } })],
      environment: "dev",
    });

    await expect(createPersistentSchemaRegistry({ configService })).rejects.toThrow(/Persisted schema registry must be an object/);
  });

  test("write failure returns failed result without updating memory", async () => {
    const configService = await createWeaverConfigService({
      providers: [createFailingProvider("p1", "platform")],
      environment: "dev",
    });
    const registry = await createPersistentSchemaRegistry({ configService });

    const result = await registry.register({
      serviceId: "svc",
      declaration: { type: "object", properties: { host: { type: "string" } } },
      environment: "dev",
    });

    expect(result.success).toBe(false);
    expect(await registry.getSchema("svc", "dev")).toBe(null);
    expect(registry.listAll()).toEqual({});
  });
});
