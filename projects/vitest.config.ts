import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    setupFiles: ["./tests/vitest-setup.mjs"],
    testTimeout: 15_000,
    hookTimeout: 10_000,
  },
});
