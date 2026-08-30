import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "adapter-firestore",
    environment: "node",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      all: true,
      skipFull: false,
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/**/*.integration.test.ts"],
      reporter: ["text"],
      thresholds: {
        perFile: true,
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
    },
  },
});
