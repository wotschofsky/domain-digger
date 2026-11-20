import { describe, expect, it, vi } from 'vitest';

import {
  findLookupFeatureBySegment,
  getLandingHref,
  getResultsHref,
  withResolverParams,
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
});

describe('withResolverParams', () => {
  it('keeps resolver and location', () => {
    expect(
      withResolverParams('/lookup/b.com', '?resolver=google&location=fra1'),
    ).toBe('/lookup/b.com?resolver=google&location=fra1');
  });

  it('drops unrelated params', () => {
    expect(
      withResolverParams('/lookup/b.com/whois', 'force&ref=bookmarklet'),
    ).toBe('/lookup/b.com/whois');
  });

  it('keeps a lone resolver', () => {
    expect(withResolverParams('/lookup/b.com', 'resolver=cloudflare')).toBe(
      '/lookup/b.com?resolver=cloudflare',
    );
  });

  // Safari 16.4, Chrome 111 and Firefox 111 lack URLSearchParams.size
  it('keeps the params in browsers without URLSearchParams.size', () => {
    const size = vi
      .spyOn(URLSearchParams.prototype, 'size', 'get')
      .mockReturnValue(undefined as unknown as number);
    try {
      expect(
        withResolverParams('/lookup/b.com', 'resolver=google&location=fra1'),
      ).toBe('/lookup/b.com?resolver=google&location=fra1');
    } finally {
      size.mockRestore();
    }
  });
});
