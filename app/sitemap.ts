import type { MetadataRoute } from 'next';
import { parse as parseTldts } from 'tldts';

import { EXAMPLE_DOMAINS } from '@/lib/data';
import { getTopDomains } from '@/lib/search';
import { deduplicate } from '@/lib/utils';

const SITE_URL = process.env.SITE_URL;
const RESULTS_SUBPATHS = ['', '/certs', '/map', '/subdomains', '/whois'];

const getSitemapPaths = async () => {
  const topDomains = await getTopDomains(1000);

  const namedDomains = deduplicate([...EXAMPLE_DOMAINS, ...topDomains]);
  const tlds = deduplicate(namedDomains.map((d) => parseTldts(d).publicSuffix));

  const allDomains = [
    ...namedDomains,
    ...namedDomains.map((domain) => 'www.' + domain),
    ...tlds,
  ].toSorted();

  const resultsPaths = allDomains.flatMap((domain) =>
    RESULTS_SUBPATHS.map((suffix) => '/lookup/' + domain + suffix)
  );

  return resultsPaths;
};

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  if (!SITE_URL) {
    return [];
  }

  const paths = await getSitemapPaths();

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 1,
    },
    ...paths.map((url) => ({
      url: SITE_URL + url,
      lastModified: new Date(),
      changeFrequency: 'always' as const,
      priority: 0.5,
    })),
  ];
};

export default sitemap;
