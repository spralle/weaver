import { describe, expect, it } from "bun:test";
import { createScompTransport, WeaverConfig } from "../src/index";

describe("transport-scomp", () => {
  it("exports the contract token with correct name", () => {
    expect(WeaverConfig.name).toBe("weaver-config-v1");
  });

  it("exports createScompTransport function", () => {
    expect(typeof createScompTransport).toBe("function");
  });
});
