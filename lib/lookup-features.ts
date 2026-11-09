import type { Metadata } from 'next';

export const LOOKUP_FEATURES = [
  {
    id: 'dns',
    label: 'DNS',
    // Layout segment of the results tab
    segment: '(dns)',
    // Results path below /lookup/<domain>
    path: '',
    footerLabel: 'DNS Lookup',
  },
  {
    id: 'map',
    label: 'DNS Map',
    segment: 'map',
    path: '/map',
    footerLabel: 'Global DNS Lookup',
  },
  {
    id: 'dnssec',
    label: 'DNSSEC',
    segment: 'dnssec',
    path: '/dnssec',
    footerLabel: 'DNSSEC Lookup',
  },
  {
    id: 'whois',
    label: 'Whois',
    segment: 'whois',
    path: '/whois',
    footerLabel: 'WHOIS Lookup',
  },
  {
    id: 'certs',
    label: 'Certs',
    segment: 'certs',
    path: '/certs',
    footerLabel: 'Certificate Logs',
  },
  {
    id: 'subdomains',
    label: 'Subdomains',
    segment: 'subdomains',
    path: '/subdomains',
    footerLabel: 'Subdomains Finder',
  },
] as const;

export type LookupFeatureId = (typeof LOOKUP_FEATURES)[number]['id'];

const getPath = (id: LookupFeatureId) =>
  LOOKUP_FEATURES.find((feature) => feature.id === id)!.path;

export const findLookupFeatureBySegment = (segment: string | null) =>
  LOOKUP_FEATURES.find((feature) => feature.segment === segment);

export const getResultsHref = (id: LookupFeatureId, domain: string) =>
  `/lookup/${domain}${getPath(id)}`;

// Each tab's landing page sits at its results path; the DNS tab's is the home
// page
export const getLandingHref = (id: LookupFeatureId) => getPath(id) || '/';

export const getPageMetadata = (url: string, title?: string): Metadata => {
  // A title key, even undefined, replaces the root layout's title
  const titles = title ? { title } : {};
  return {
    ...titles,
    openGraph: { ...titles, url },
    alternates: { canonical: url },
  };
};
