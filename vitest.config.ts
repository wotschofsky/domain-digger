import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    alias: {
      '@/': new URL('./', import.meta.url).pathname,
    },
  },
});
