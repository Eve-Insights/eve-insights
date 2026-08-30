import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Identifies this project in Vitest output and CI annotations.
    name: "reporter",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
