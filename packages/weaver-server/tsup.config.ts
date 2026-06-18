import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts", "src/transport/auth-gate.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
});
