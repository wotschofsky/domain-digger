import type { NextConfig } from 'next';

import { env } from '@/env';

// Fetch the avatar URLs of every account currently sponsoring on GitHub. Kept
// self-contained (rather than importing lib/github) because Next only resolves
// the config entry's own imports — a transitively imported module's path
// aliases fail to resolve when the compiled config is required at runtime.
const getGitHubSponsorAvatarUrls = async (): Promise<string[]> => {
  if (!env.GITHUB_TOKEN) {
    return [];
  }

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        query: `
          query {
            user(login: "wotschofsky") {
              sponsorshipsAsMaintainer(first: 100) {
                nodes {
                  sponsorEntity {
                    ... on Actor {
                      avatarUrl
                    }
                  }
                }
              }
            }
          }
        `,
      }),
    });
    const body = await response.json();
    return body.data.user.sponsorshipsAsMaintainer.nodes.map(
      (node: { sponsorEntity: { avatarUrl: string } }) =>
        node.sponsorEntity.avatarUrl,
    );
  } catch {
    return [];
  }
};

// Allow image optimization only for the exact logo/avatar URL of every sponsor
// we actually render: the ones configured via SPONSORS plus the GitHub Sponsors
// avatars — instead of wildcard-allowing all of avatars.githubusercontent.com.
const getSponsorImageUrls = async (): Promise<URL[]> =>
  [
    ...(env.SPONSORS || []).map((sponsor) => sponsor.logoUrl),
    ...(await getGitHubSponsorAvatarUrls()),
  ].map((url) => new URL(url));

const nextConfig = async (): Promise<NextConfig> => ({
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
      ...(await getSponsorImageUrls()),
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
});

export default nextConfig;
