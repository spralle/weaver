import { z } from "zod";
import {
  defineNamespace,
  type NamespaceDefinition,
  type TypedInstanceClient,
  type TypedNamespaceClient,
} from "../src/namespace.js";

describe("defineNamespace", () => {
  it("stores the prefix correctly", () => {
    const def = defineNamespace("database", {
      host: z.string(),
      port: z.number(),
    });
    expect(def.prefix).toBe("database");
  });

  it("creates a valid ZodObject schema", () => {
    const def = defineNamespace("database", {
      host: z.string(),
      port: z.number(),
    });
    // Verify it can parse valid data
    const result = def.schema.parse({ host: "localhost", port: 5432 });
    expect(result).toEqual({ host: "localhost", port: 5432 });
  });

  it("rejects invalid data via schema", () => {
    const def = defineNamespace("database", {
      host: z.string(),
      port: z.number(),
    });
    expect(() => def.schema.parse({ host: 123, port: "bad" })).toThrow();
  });

  it("supports nested shapes", () => {
    const def = defineNamespace("db", {
      connection: z.object({ host: z.string(), port: z.number() }),
    });
    const result = def.schema.parse({
      connection: { host: "localhost", port: 5432 },
    });
    expect(result).toEqual({ connection: { host: "localhost", port: 5432 } });
  });
});

// ─── Type-level compilation tests ─────────────────────────
// These verify TypeScript inference works correctly.
// No runtime assertions needed — if this file compiles, the types are correct.

describe("TypedNamespaceClient type inference", () => {
  it("compiles with correct key/value types", () => {
    const def = defineNamespace("test", {
      name: z.string(),
      count: z.number(),
      enabled: z.boolean(),
    });

    // Verify the definition type is correctly inferred
    type Def = typeof def;
    type _AssertPrefix =
      Def extends NamespaceDefinition<"test", infer _S> ? true : never;

    // Simulate typed client usage (type-level only)
    type Client = TypedNamespaceClient<
      typeof def extends NamespaceDefinition<string, infer S> ? S : never
    >;

    // These type assignments verify inference works
    const _clientUsage = (client: Client) => {
      // get returns correct type
      const _name: string | undefined = client.get("name");
      const _count: number | undefined = client.get("count");

      // getOrDefault returns non-optional
      const _enabled: boolean = client.getOrDefault("enabled", false);

      // set requires correct value type
      void client.set("name", "hello");
      void client.set("count", 42);
    };

    // Verify instance client types
    type Instance = TypedInstanceClient<
      typeof def extends NamespaceDefinition<string, infer S> ? S : never
    >;

    const _instanceUsage = (inst: Instance) => {
      const _val: string | undefined = inst.get("name");
      void inst.set("count", 10);
      void inst.reset();
    };

    expect(true).toBeTruthy();
  });
});
