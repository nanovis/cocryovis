import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts", "!src/**/*.mjs"],
  format: ["esm"],
  target: "node18",
  bundle: true,
  dts: true,
  clean: true,
  outDir: "dist",
  sourcemap: true,
  splitting: false,
});
