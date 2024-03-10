import type { MetadataRoute } from 'next';

import { EXAMPLE_DOMAINS } from '@/lib/data';

const SITE_URL = process.env.SITE_URL;

const tlds = EXAMPLE_DOMAINS.map((domain) => domain.replace(/^.+\./, ''));
const uniqueTlds = Array.from(new Set(tlds));

const domains = [
  ...EXAMPLE_DOMAINS,
  ...EXAMPLE_DOMAINS.map((domain) => 'www.' + domain),
  ...uniqueTlds,
];
domains.sort();

const sitemap = (): MetadataRoute.Sitemap =>
  SITE_URL
    ? [
        {
          url: SITE_URL,
          lastModified: new Date(),
          changeFrequency: 'monthly' as const,
          priority: 1,
        },
        ...domains.flatMap((domain) =>
          ['', '/certs', '/map', '/subdomains', '/whois'].map((suffix) => ({
            url: SITE_URL + '/lookup/' + domain + suffix,
            lastModified: new Date(),
            changeFrequency: 'always' as const,
            priority: 0.5,
          }))
        ),
      ]
    : [];

export default sitemap;
