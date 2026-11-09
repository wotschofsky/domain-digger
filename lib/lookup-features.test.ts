import { describe, expect, it } from 'vitest';

import {
  findLookupFeatureBySegment,
  getLandingHref,
  getPageMetadata,
  getResultsHref,
} from './lookup-features';

describe('lookup features', () => {
  it.each([
    ['dns', '(dns)', '/lookup/example.com', '/'],
    ['map', 'map', '/lookup/example.com/map', '/map'],
    ['dnssec', 'dnssec', '/lookup/example.com/dnssec', '/dnssec'],
    ['whois', 'whois', '/lookup/example.com/whois', '/whois'],
    ['certs', 'certs', '/lookup/example.com/certs', '/certs'],
    [
      'subdomains',
      'subdomains',
      '/lookup/example.com/subdomains',
      '/subdomains',
    ],
  ] as const)(
    '%s is found by segment %s and links to %s and %s',
    (id, segment, resultsHref, landingHref) => {
      expect(findLookupFeatureBySegment(segment)?.id).toBe(id);
      expect(getResultsHref(id, 'example.com')).toBe(resultsHref);
      expect(getLandingHref(id)).toBe(landingHref);
    },
  );

  it('has no feature for an unknown or missing segment', () => {
    expect(findLookupFeatureBySegment('exposure')).toBeUndefined();
    expect(findLookupFeatureBySegment(null)).toBeUndefined();
  });

  it('points the canonical and og url at the page', () => {
    expect(
      getPageMetadata('/lookup/example.com/whois?force', 'WHOIS Lookup'),
    ).toEqual({
      title: 'WHOIS Lookup',
      openGraph: {
        title: 'WHOIS Lookup',
        url: '/lookup/example.com/whois?force',
      },
      alternates: { canonical: '/lookup/example.com/whois?force' },
    });
  });

  // A title key, even undefined, replaces the root layout's title
  it('leaves the title to the root layout when none is given', () => {
    expect(getPageMetadata('/')).toEqual({
      openGraph: { url: '/' },
      alternates: { canonical: '/' },
    });
  });
});
