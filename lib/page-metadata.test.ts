import { describe, expect, it } from 'vitest';

import { getPageMetadata } from './page-metadata';

describe('getPageMetadata', () => {
  it('points the canonical and og url at the page', () => {
    expect(
      getPageMetadata({
        url: '/lookup/example.com/whois?force',
        title: 'WHOIS Lookup',
      }),
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
    expect(getPageMetadata({ url: '/' })).toEqual({
      openGraph: { url: '/' },
      alternates: { canonical: '/' },
    });
  });
});
