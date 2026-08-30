import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Identifies this project in Vitest output and CI annotations.
    name: "agent",
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.ts"],
  },
});
