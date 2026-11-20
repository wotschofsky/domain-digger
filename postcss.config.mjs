// ESM on purpose: as CommonJS, Turbopack wraps this in a generated
// `postcss.config.js_.loader.mjs` that calls a missing async-module helper
// (`__turbopack_context__.a is not a function`), which fails the build whenever
// a CSS file actually has to be recompiled. Regressed in Next.js 16.3.0.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
