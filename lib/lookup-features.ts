export const LOOKUP_FEATURES = [
  {
    id: 'dns',
    label: 'DNS',
    segment: '(dns)',
    path: '',
    landingPath: '/',
    footerLabel: 'DNS Lookup',
    lookupType: 'dns',
  },
  {
    id: 'map',
    label: 'DNS Map',
    segment: 'map',
    path: '/map',
    landingPath: '/map',
    footerLabel: 'Global DNS Lookup',
    lookupType: 'dns',
  },
  {
    id: 'whois',
    label: 'Whois',
    segment: 'whois',
    path: '/whois',
    landingPath: '/whois',
    footerLabel: 'WHOIS Lookup',
    lookupType: 'whois',
  },
  {
    id: 'certs',
    label: 'Certs',
    segment: 'certs',
    path: '/certs',
    landingPath: '/certs',
    footerLabel: 'Certificate Logs',
    lookupType: 'certs',
  },
  {
    id: 'subdomains',
    label: 'Subdomains',
    segment: 'subdomains',
    path: '/subdomains',
    landingPath: '/subdomains',
    footerLabel: 'Subdomains Finder',
    lookupType: 'subdomains',
  },
] as const;

export type LookupType = (typeof LOOKUP_FEATURES)[number]['lookupType'];
