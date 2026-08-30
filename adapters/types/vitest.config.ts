import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Identifies this project in Vitest output and CI annotations.
    name: "adapter-types",
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
