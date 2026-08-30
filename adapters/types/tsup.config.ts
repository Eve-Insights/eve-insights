import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/contract.ts"],
  external: ["vitest"],
  // ESM only — this package is never published and every consumer in the
  // repository is ESM, so there is no reason to carry a CJS build.
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2023",
});
