import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  test: {
    environment: 'happy-dom',
    alias: {
      '@/': new URL('./', import.meta.url).pathname,
    },
    // `vitest run --mode network` opts into the live network suites; mapping
    // the mode to an env var here keeps the gate cross-platform (no inline
    // env-var syntax) and typed (no ImportMeta.env augmentation needed).
    // Only set on that mode -- an entry here overrides process.env, so always
    // setting it would clobber a caller's own RUN_NETWORK_TESTS=1.
    env: mode === 'network' ? { RUN_NETWORK_TESTS: '1' } : {},
  },
}));
