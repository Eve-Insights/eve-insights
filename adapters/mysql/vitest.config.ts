import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "adapter-mysql",
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
