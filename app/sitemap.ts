import type { MetadataRoute } from 'next';
import { parse as parseTldts } from 'tldts';

import { env } from '@/env';
import { EXAMPLE_DOMAINS } from '@/lib/data';
import { getTopDomains } from '@/lib/search';
import { deduplicate } from '@/lib/utils';

const LANDING_PAGES = ['', '/certs', '/map', '/subdomains', '/whois'];
const RESULTS_SUBPATHS = ['', '/certs', '/map', '/subdomains', '/whois'];

const getProgrammaticPaths = async () => {
  const topDomains = await getTopDomains(1000);

  const namedDomains = deduplicate([...EXAMPLE_DOMAINS, ...topDomains]);
  const tlds = deduplicate(namedDomains.map((d) => parseTldts(d).publicSuffix));

  const allDomains = [
    ...namedDomains,
    ...namedDomains.map((domain) => 'www.' + domain),
    ...tlds,
  ].toSorted();

  const resultsPaths = allDomains.flatMap((domain) =>
    RESULTS_SUBPATHS.map((suffix) => '/lookup/' + domain + suffix),
  );

  return resultsPaths;
};

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  if (!env.SITE_URL) {
    return [];
  }

  const programmaticPaths = await getProgrammaticPaths();

  return [
    ...LANDING_PAGES.map((url) => ({
      url: env.SITE_URL + url,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 1,
    })),
    ...programmaticPaths.map((url) => ({
      url: env.SITE_URL + url,
      lastModified: new Date(),
      changeFrequency: 'always' as const,
      priority: 0.5,
    })),
  ];
};

export default sitemap;
