import type { WeaverConfigService } from "../src/core/config-service.js";
import { createSchemaRegistry } from "../src/core/schema-registry.js";

const configService = {} as WeaverConfigService;

describe("SchemaRegistry", () => {
  it("registers service schema metadata with a derived service path", async () => {
    const registry = createSchemaRegistry({ configService });
    const result = await registry.register({
      serviceId: "lynx",
      environment: "default",
      owner: { name: "Lynx", contact: "lynx@example.com" },
      schema: { type: "object" },
      fragmentSlots: [{ slotPath: "/plugins", accepts: "object" }],
    });

    expect(result.success).toBe(true);
    expect(result.metadata).toEqual({
      serviceId: "lynx",
      servicePath: "/lynx",
      environment: "default",
    });
    expect(await registry.getSchema("lynx", "default")).toEqual({
      type: "object",
    });
    expect(Object.keys(registry.listAll())).toEqual(["/lynx:default"]);
  });

  it("registers fragment schema metadata with canonical paths", async () => {
    const registry = createSchemaRegistry({ configService });
    const result = await registry.register({
      serviceId: "lynx",
      providerId: "ghost.settings.panel",
      slotPath: "/plugins",
      environment: "default",
      owner: { name: "Ghost", contact: "ghost@example.com" },
      schema: { type: "object" },
    });

    expect(result.success).toBe(true);
    expect(result.metadata).toEqual({
      serviceId: "lynx",
      servicePath: "/lynx",
      canonicalSlotPath: "/lynx/plugins",
      providerId: "ghost.settings.panel",
      fragmentPath: "/lynx/plugins/ghost.settings.panel",
      environment: "default",
    });
    expect(Object.keys(registry.listAll())).toEqual([
      "/lynx/plugins/ghost.settings.panel:default",
    ]);
  });

  it("rejects registrations under the protected Weaver root", async () => {
    const registry = createSchemaRegistry({ configService });
    const result = await registry.register({
      serviceId: "_weaver",
      environment: "default",
      owner: { name: "Internal", contact: "platform@example.com" },
      schema: { type: "object" },
      fragmentSlots: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });
});
