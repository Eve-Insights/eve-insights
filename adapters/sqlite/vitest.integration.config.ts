import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "adapter-sqlite-integration",
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
  },
});
