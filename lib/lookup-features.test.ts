import { describe, expect, it } from 'vitest';

import {
  findLookupFeatureBySegment,
  getLandingMetadata,
  getLookupFeature,
  getResultsHref,
  getResultsMetadata,
  getSitemapResultsHrefs,
  LOOKUP_FEATURES,
} from './lookup-features';

describe('lookup features', () => {
  it.each([
    ['dns', '(dns)', '/lookup/example.com', '/', false],
    ['map', 'map', '/lookup/example.com/map', '/map', true],
    ['dnssec', 'dnssec', '/lookup/example.com/dnssec', '/dnssec', false],
    ['whois', 'whois', '/lookup/example.com/whois', '/whois', false],
    ['certs', 'certs', '/lookup/example.com/certs', '/certs', true],
    [
      'subdomains',
      'subdomains',
      '/lookup/example.com/subdomains',
      '/subdomains',
      false,
    ],
  ] as const)(
    '%s is found by segment %s and links to %s',
    (id, segment, href, landingPath, fullWidth) => {
      const feature = getLookupFeature(id);

      expect(findLookupFeatureBySegment(segment)).toBe(feature);
      expect(getResultsHref(feature, 'example.com')).toBe(href);
      expect(getResultsMetadata(feature, 'example.com')).toMatchObject({
        openGraph: { url: href },
        alternates: { canonical: href },
      });
      expect(getLandingMetadata(feature)).toMatchObject({
        openGraph: { url: landingPath },
        alternates: { canonical: landingPath },
      });
      expect(Boolean(feature.fullWidth)).toBe(fullWidth);
    },
  );

  it('has no feature for an unknown or missing segment', () => {
    expect(findLookupFeatureBySegment('exposure')).toBeUndefined();
    expect(findLookupFeatureBySegment(null)).toBeUndefined();
  });

  it('titles results pages after the feature and domain', () => {
    expect(
      getResultsMetadata(getLookupFeature('map'), 'example.com'),
    ).toMatchObject({
      title: 'DNS Propagation for example.com',
      openGraph: { title: 'DNS Propagation for example.com' },
    });
  });

  it('keeps query parameters that change the results', () => {
    expect(
      getResultsMetadata(getLookupFeature('whois'), 'example.com', '?force'),
    ).toMatchObject({
      openGraph: { url: '/lookup/example.com/whois?force' },
      alternates: { canonical: '/lookup/example.com/whois?force' },
    });
  });

  // A title key, even undefined, replaces the root layout's title
  it('leaves the home page title to the root layout', () => {
    const metadata = getLandingMetadata(getLookupFeature('dns'));

    expect(metadata).not.toHaveProperty('title');
    expect(metadata.openGraph).not.toHaveProperty('title');
  });

  it('leaves bot-blocked results pages out of the sitemap', () => {
    expect(getSitemapResultsHrefs('example.com')).toEqual([
      '/lookup/example.com',
      '/lookup/example.com/dnssec',
      '/lookup/example.com/whois',
      '/lookup/example.com/certs',
      '/lookup/example.com/subdomains',
    ]);
    expect(LOOKUP_FEATURES.filter((f) => f.blocksBots)).toEqual([
      getLookupFeature('map'),
    ]);
  });
});
