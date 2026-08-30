import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "adapter-mysql-integration",
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
  },
});
