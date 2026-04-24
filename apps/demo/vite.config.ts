import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: ".",
  build: { outDir: "dist" },
  resolve: {
    alias: {
      "node:fs/promises": resolve(__dirname, "src/stubs/node-fs.ts"),
      "node:path": resolve(__dirname, "src/stubs/node-path.ts"),
    },
  },
});
