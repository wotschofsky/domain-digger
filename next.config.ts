import type { NextConfig } from 'next';
import type { RemotePattern } from 'next/dist/shared/lib/image-config';

// Derive an exact-match image remote pattern for every external sponsorship
// logo URL configured via the SPONSORS environment variable, so Next.js image
// optimization only ever allows the precise URLs we actually render.
const getSponsorImagePatterns = (): RemotePattern[] => {
  const raw = process.env.SPONSORS;
  if (!raw) {
    return [];
  }

  let sponsors: Array<{ logoUrl?: string }>;
  try {
    sponsors = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(sponsors)) {
    return [];
  }

  const patterns: RemotePattern[] = [];
  for (const sponsor of sponsors) {
    if (!sponsor?.logoUrl) {
      continue;
    }

    let url: URL;
    try {
      url = new URL(sponsor.logoUrl);
    } catch {
      continue;
    }

    const protocol = url.protocol.replace(/:$/, '');
    if (protocol !== 'http' && protocol !== 'https') {
      continue;
    }

    patterns.push({
      protocol,
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: url.pathname,
      search: url.search,
    });
  }

  return patterns;
};

const nextConfig: NextConfig = {
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
      ...getSponsorImagePatterns(),
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

export default nextConfig;
