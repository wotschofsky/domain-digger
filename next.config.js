/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  images: {
    remotePatterns: [
      {
        hostname: 'static.wsky.dev',
        pathname: '/branding/**',
      },
      {
        hostname: 'avatars.githubusercontent.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  redirects: async () => [
    {
      source: '/lookup',
      destination: '/',
      permanent: true,
    },
  ],
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
      ],
    },
  ],
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  outputFileTracingIncludes: {
    // Tracing keys are picomatch globs — escape the dynamic-segment brackets
    // so they're matched literally instead of as a character class.
    '/lookup/\\[domain\\]/subdomains': ['./bin/subfinder'],
  },
};

module.exports = nextConfig;
