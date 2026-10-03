import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // One run builds every theme twice (core + Style Dictionary).
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
