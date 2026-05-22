import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/subpaths/schemas.ts",
    "src/subpaths/sync.ts",
    "src/subpaths/session.ts",
    "src/subpaths/access.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
});
