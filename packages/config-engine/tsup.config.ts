import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/contract-derivation.ts",
    "src/json-schema-generator.ts",
    "src/layers.ts",
    "src/scope.ts",
    "src/zod-schema-generator.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
});
