import type { Metadata } from 'next';

type LookupFeatureRow = {
  id: string;
  label: string;
  // Layout segment of the results tab
  segment: string;
  // Results path below /lookup/<domain>
  path: string;
  landingPath: string;
  footerLabel: string;
  lookupType: string;
  // Results page title, followed by "for <domain>"
  title: string;
  // Left out where the landing page keeps the site's default title
  landingTitle?: string;
  // Bots get a block page instead, so the results stay out of the sitemap
  blocksBots?: boolean;
  // The results need the full width of the results card, without an ad rail
  fullWidth?: boolean;
};

const ROWS = [
  {
    id: 'dns',
    label: 'DNS',
    segment: '(dns)',
    path: '',
    landingPath: '/',
    footerLabel: 'DNS Lookup',
    lookupType: 'dns',
    title: 'DNS Lookup',
  },
  {
    id: 'map',
    label: 'DNS Map',
    segment: 'map',
    path: '/map',
    landingPath: '/map',
    footerLabel: 'Global DNS Lookup',
    lookupType: 'dns',
    title: 'DNS Propagation',
    landingTitle: 'DNS Propagation Map',
    blocksBots: true,
    fullWidth: true,
  },
  {
    id: 'dnssec',
    label: 'DNSSEC',
    segment: 'dnssec',
    path: '/dnssec',
    landingPath: '/dnssec',
    footerLabel: 'DNSSEC Lookup',
    lookupType: 'dnssec',
    title: 'DNSSEC Lookup',
    landingTitle: 'DNSSEC Lookup',
  },
  {
    id: 'whois',
    label: 'Whois',
    segment: 'whois',
    path: '/whois',
    landingPath: '/whois',
    footerLabel: 'WHOIS Lookup',
    lookupType: 'whois',
    title: 'WHOIS Lookup',
    landingTitle: 'WHOIS Lookup',
  },
  {
    id: 'certs',
    label: 'Certs',
    segment: 'certs',
    path: '/certs',
    landingPath: '/certs',
    footerLabel: 'Certificate Logs',
    lookupType: 'certs',
    title: 'Certificate Logs',
    landingTitle: 'Certificate Search',
    fullWidth: true,
  },
  {
    id: 'subdomains',
    label: 'Subdomains',
    segment: 'subdomains',
    path: '/subdomains',
    landingPath: '/subdomains',
    footerLabel: 'Subdomains Finder',
    lookupType: 'subdomains',
    title: 'Subdomain Search',
    landingTitle: 'Subdomain Search',
  },
] as const satisfies readonly LookupFeatureRow[];

export type LookupType = (typeof ROWS)[number]['lookupType'];

export type LookupFeature = LookupFeatureRow & {
  id: (typeof ROWS)[number]['id'];
  lookupType: LookupType;
};

export const LOOKUP_FEATURES: readonly LookupFeature[] = ROWS;

export const getLookupFeature = (id: LookupFeature['id']) =>
  LOOKUP_FEATURES.find((feature) => feature.id === id)!;

export const findLookupFeatureBySegment = (segment: string | null) =>
  LOOKUP_FEATURES.find((feature) => feature.segment === segment);

export const getResultsHref = (feature: LookupFeature, domain: string) =>
  `/lookup/${domain}${feature.path}`;

// `search` keeps query parameters that change the results, like `?force`
export const getResultsMetadata = (
  feature: LookupFeature,
  domain: string,
  search = '',
): Metadata => {
  const title = `${feature.title} for ${domain}`;
  const url = getResultsHref(feature, domain) + search;
  return { title, openGraph: { title, url }, alternates: { canonical: url } };
};

export const getLandingMetadata = ({
  landingTitle,
  landingPath,
}: LookupFeature): Metadata => {
  // A title key set to undefined would replace the inherited title
  const titles = landingTitle ? { title: landingTitle } : {};
  return {
    ...titles,
    openGraph: { ...titles, url: landingPath },
    alternates: { canonical: landingPath },
  };
};

export const getSitemapResultsHrefs = (domain: string) =>
  LOOKUP_FEATURES.filter((feature) => !feature.blocksBots).map((feature) =>
    getResultsHref(feature, domain),
  );
