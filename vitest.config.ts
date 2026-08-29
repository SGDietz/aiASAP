// Replay harness config (2026-06-10). Only runs OUR tests under tests/ —
// packages/js-sdk ships its own vendored vitest specs we never run here.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
