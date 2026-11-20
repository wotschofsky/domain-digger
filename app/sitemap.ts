import type { MetadataRoute } from 'next';
import { cacheLife } from 'next/cache';
import { parse as parseTldts } from 'tldts';

import { env } from '@/env';
import { EXAMPLE_DOMAINS } from '@/lib/data';
import {
  getLandingHref,
  getResultsHref,
  LOOKUP_FEATURES,
} from '@/lib/lookup-features';
import { getTopDomains } from '@/lib/search';
import { deduplicate } from '@/lib/utils';

const LANDING_PAGES = LOOKUP_FEATURES.map((feature) =>
  getLandingHref(feature.id),
);

// The map page shows bots a block page instead of results
const INDEXED_RESULTS = LOOKUP_FEATURES.filter(
  (feature) => feature.id !== 'map',
);

const getProgrammaticPaths = async () => {
  const topDomains = await getTopDomains(1000);

  const namedDomains = deduplicate([...EXAMPLE_DOMAINS, ...topDomains]);
  const tlds = deduplicate(
    namedDomains.flatMap((d) => parseTldts(d).publicSuffix ?? []),
  );

  const allDomains = [
    ...namedDomains,
    ...namedDomains.map((domain) => 'www.' + domain),
    ...tlds,
  ].toSorted();

  const resultsPaths = allDomains.flatMap((domain) =>
    INDEXED_RESULTS.map((feature) => getResultsHref(feature.id, domain)),
  );

  return resultsPaths;
};

// Cached so the sitemap is still prerendered instead of querying BigQuery on
// every request
const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  'use cache';
  cacheLife('max');

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
