import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "adapter-supabase",
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
