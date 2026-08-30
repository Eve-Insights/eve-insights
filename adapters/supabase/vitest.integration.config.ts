import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "adapter-supabase-integration",
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
  },
});
