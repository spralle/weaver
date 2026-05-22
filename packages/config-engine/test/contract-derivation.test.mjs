import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveContractFromPackageJson } from "../dist/contract-derivation.js";

describe("deriveContractFromPackageJson", () => {
  it("derives correct namespace from scoped package name", () => {
    const result = deriveContractFromPackageJson({
      name: "@weaver-conf/vessel-view-plugin",
      version: "1.0.0",
    });
    assert.equal(result.pluginId, "@weaver-conf/vessel-view-plugin");
    assert.equal(result.namespace, "weaverConf.vesselView");
    assert.equal(result.version, "1.0.0");
  });

  it("derives correct namespace from dotted package name", () => {
    const result = deriveContractFromPackageJson({
      name: "ghost.vessel-view",
      version: "2.0.0",
    });
    assert.equal(result.namespace, "ghost.vesselView");
  });

  it("derives correct namespace from unscoped name", () => {
    const result = deriveContractFromPackageJson({
      name: "my-config-tool",
      version: "1.0.0",
    });
    assert.equal(result.namespace, "myConfigTool");
    assert.equal(result.pluginId, "my-config-tool");
  });

  it("uses explicit weaver.configNamespace override", () => {
    const result = deriveContractFromPackageJson({
      name: "@weaver-conf/some-plugin",
      version: "1.0.0",
      weaver: { configNamespace: "custom.namespace" },
    });
    assert.equal(result.namespace, "custom.namespace");
    assert.equal(result.pluginId, "@weaver-conf/some-plugin");
  });

  it("defaults version to '0.0.0' when missing", () => {
    const result = deriveContractFromPackageJson({
      name: "@weaver-conf/test-plugin",
    });
    assert.equal(result.version, "0.0.0");
  });

  it("defaults description to empty string when missing", () => {
    const result = deriveContractFromPackageJson({
      name: "@weaver-conf/test-plugin",
    });
    assert.equal(result.description, "");
  });

  it("returns all fields when all are present", () => {
    const result = deriveContractFromPackageJson({
      name: "@weaver-conf/vessel-view-plugin",
      version: "3.2.1",
      description: "Vessel view configuration plugin",
    });
    assert.deepStrictEqual(result, {
      pluginId: "@weaver-conf/vessel-view-plugin",
      namespace: "weaverConf.vesselView",
      version: "3.2.1",
      description: "Vessel view configuration plugin",
    });
  });

  it("converts hyphens in package name to camelCase namespace", () => {
    const result = deriveContractFromPackageJson({
      name: "@weaver-conf/theme-default-plugin",
      version: "1.0.0",
    });
    assert.equal(result.namespace, "weaverConf.themeDefault");
  });

  it("preserves pluginId as the raw package name", () => {
    const result = deriveContractFromPackageJson({
      name: "@scope/my-fancy-plugin",
      version: "0.1.0",
    });
    assert.equal(result.pluginId, "@scope/my-fancy-plugin");
    assert.equal(result.namespace, "scope.myFancy");
  });

  it("handles weaver field with no configNamespace", () => {
    const result = deriveContractFromPackageJson({
      name: "@weaver-conf/nav-plugin",
      weaver: {},
    });
    assert.equal(result.namespace, "weaverConf.nav");
    assert.equal(result.version, "0.0.0");
  });
});
