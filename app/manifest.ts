import type { MetadataRoute } from 'next';

const manifest = (): MetadataRoute.Manifest => ({
  name: 'Domain Digger: DNS, WHOIS lookup & more',
  short_name: 'Domain Digger',
  description:
    'Domain Digger is the full open-source toolkit for next-level domain analysis, providing detailed DNS, IP, WHOIS data, and SSL/TLS history in a user-friendly, no-install interface.',
  lang: 'en',
  start_url: '/',
  display: 'standalone',
  // Dark mode background color
  background_color: '#020817',
  theme_color: '#020817',
  icons: [
    {
      src: '/icon.svg',
      type: 'image/svg+xml',
      sizes: 'any',
    },
    {
      src: '/favicon.ico',
      type: 'image/x-icon',
      sizes: '48x48',
    },
  ],
});

export default manifest;
