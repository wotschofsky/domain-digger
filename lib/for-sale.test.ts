import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lookupForSale, parseForSaleRecords } from './for-sale';

describe('RFC 10023 records', () => {
  it.each(
    [
      [],
      ['I am for sale'],
      ['v=forsale1;'],
      ['v=FORSALE2;'],
      ['v=FORSALE1'],
      [' v=FORSALE1;'],
      ['unrelated v=FORSALE1;'],
    ].map((records) => ({ records })),
  )(
    'ignores records without the exact version marker: $records',
    ({ records }) => {
      expect(parseForSaleRecords(records)).toBeNull();
    },
  );

  it.each([
    'v=FORSALE1;',
    'v=FORSALE1;foo=bar',
    'v=FORSALE1;fcod=NLFS-abc',
    'v=FORSALE1;fval=invalid',
  ])('recognizes a marker even without usable details: %s', (record) => {
    expect(parseForSaleRecords([record])).toEqual({
      prices: [],
      links: [],
      texts: [],
    });
  });

  it('combines and deduplicates details from separate records', () => {
    expect(
      parseForSaleRecords([
        'v=FORSALE1;fval=EUR2500',
        'v=FORSALE1;fval=BTC0.000010',
        'v=FORSALE1;furi=https://seller.example/buy',
        'v=FORSALE1;furi=mailto:hello@seller.example',
        'v=FORSALE1;furi=tel:+4930123456',
        'v=FORSALE1;ftxt=Call for information.',
        'v=FORSALE1; fval=EUR2500',
      ]),
    ).toEqual({
      prices: ['EUR 2500', 'BTC 0.000010'],
      links: [
        'https://seller.example/buy',
        'mailto:hello@seller.example',
        'tel:+4930123456',
      ],
      texts: ['Call for information.'],
    });
  });

  it('treats a semicolon in content as part of the value, not another tag', () => {
    expect(
      parseForSaleRecords(['v=FORSALE1;ftxt=Contact me;fval=EUR500']),
    ).toEqual({
      prices: [],
      links: [],
      texts: ['Contact me;fval=EUR500'],
    });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'https://user:pass@seller.example/',
    '//seller.example/',
    'https://seller.example/has space',
    'https://seller.example/\n',
    'https://seller.example/\u202etest',
  ])('does not expose unsafe links: %s', (link) => {
    expect(parseForSaleRecords([`v=FORSALE1;furi=${link}`])?.links).toEqual([]);
  });

  it.each(['eur2500', 'EUR-1', 'EUR1e6', 'USD1,000', 'EUR500;ftxt=extra'])(
    'ignores invalid price formats: %s',
    (price) => {
      expect(parseForSaleRecords([`v=FORSALE1;fval=${price}`])?.prices).toEqual(
        [],
      );
    },
  );

  it('sanitizes control and bidi characters in human-readable text', () => {
    expect(
      parseForSaleRecords(['v=FORSALE1;ftxt=Hello\nworld\u202e!'])?.texts,
    ).toEqual(['Hello world !']);
  });

  it('keeps the signal but discards oversized content by UTF-8 byte length', () => {
    expect(parseForSaleRecords([`v=FORSALE1;ftxt=${'€'.repeat(100)}`])).toEqual(
      { prices: [], links: [], texts: [] },
    );
  });
});

describe('for-sale lookup', () => {
  const fetchMock = vi.fn();
  const answer = (data: string, TTL = 300, type = 16) => ({
    name: '_for-sale.example.com.',
    type,
    TTL,
    data,
  });
  const respond = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('looks up the registrable base domain with a deadline and no upstream cache', async () => {
    respond({ Status: 0, Answer: [answer('"v=FORSALE1;fval=EUR2500"')] });
    expect(await lookupForSale('*.WWW.Example.com.')).toEqual({
      summary: {
        domain: 'example.com',
        listing: { prices: ['EUR 2500'], links: [], texts: [] },
      },
      ttl: 300,
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      'https://dns.google/resolve?name=_for-sale.example.com&type=TXT',
    );
    expect(options.cache).toBe('no-store');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('decodes quoted chunks, escaped quotes, backslashes and UTF-8 octets', async () => {
    respond({
      Status: 0,
      Answer: [
        answer(
          String.raw`"v=FORSALE1;" "ftxt=Gr\195\188\195\159e \"friend\" \\ end"`,
        ),
      ],
    });
    expect((await lookupForSale('example.com')).summary.listing?.texts).toEqual(
      ['Grüße "friend" \\ end'],
    );
  });

  it('handles plain TXT content returned by Google for Atom listings', async () => {
    respond({
      Status: 0,
      Answer: [
        answer('v=FORSALE1;ftxt=This domain is for sale on atom.com'),
        answer('v=FORSALE1;fval=USD71256'),
        answer(
          'v=FORSALE1;furi=https://www.atom.com/name/recruitable?utm_source=forsale-dns',
        ),
      ],
    });
    expect((await lookupForSale('example.com')).summary.listing).toEqual({
      prices: ['USD 71256'],
      links: ['https://www.atom.com/name/recruitable?utm_source=forsale-dns'],
      texts: ['This domain is for sale on atom.com'],
    });
  });

  it.each([
    '"v=FORSALE1;ftxt=\\999"',
    '"v=FORSALE1;ftxt=\\255"',
    '"v=FORSALE1;" garbage',
    '"v=FORSALE1;',
  ])('ignores malformed presentation data: %s', async (data) => {
    respond({ Status: 0, Answer: [answer(data)] });
    expect((await lookupForSale('example.com')).summary.listing).toBeNull();
  });

  it('uses the smallest TTL including aliases and caps it at one hour', async () => {
    respond({
      Status: 0,
      Answer: [answer('alias.example.', 30, 5), answer('"v=FORSALE1;"', 7200)],
    });
    expect((await lookupForSale('example.com')).ttl).toBe(30);
    respond({ Status: 0, Answer: [answer('"v=FORSALE1;"', 7200)] });
    expect((await lookupForSale('example.com')).ttl).toBe(3600);
  });

  it('does not cache a zero-TTL signal', async () => {
    respond({ Status: 0, Answer: [answer('"v=FORSALE1;"', 0)] });
    expect((await lookupForSale('example.com')).ttl).toBe(0);
  });

  it.each([
    { Status: 0 },
    { Status: 3 },
    { Status: 0, Answer: [answer('"unrelated TXT"')] },
  ])('returns no signal without negative caching: %j', async (body) => {
    respond(body);
    expect(await lookupForSale('example.com')).toEqual({
      summary: { domain: 'example.com', listing: null },
      ttl: 0,
    });
  });

  it.each([
    { Status: 2 },
    { Status: 5 },
    { Status: 0, TC: true },
    {},
    { Status: 0, Answer: [answer('"v=FORSALE1;"', -1)] },
  ])('rejects DNS errors, truncated or invalid responses: %j', async (body) => {
    respond(body);
    await expect(lookupForSale('example.com')).rejects.toThrow();
  });

  it('rejects HTTP and network failures', async () => {
    respond({}, 503);
    await expect(lookupForSale('example.com')).rejects.toThrow('HTTP 503');
    fetchMock.mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
    await expect(lookupForSale('example.com')).rejects.toThrow('Timed out');
  });

  it('rejects invalid input before making a lookup', async () => {
    await expect(lookupForSale('example.com&name=evil.com')).rejects.toThrow(
      'Invalid domain',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
