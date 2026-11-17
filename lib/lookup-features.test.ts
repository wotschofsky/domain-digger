import { describe, expect, it } from 'vitest';

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
});
