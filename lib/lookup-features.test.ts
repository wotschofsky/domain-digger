import { describe, expect, it, vi } from 'vitest';

import { withResolverParams } from './lookup-features';

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
