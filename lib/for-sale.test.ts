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
    'https://seller.example/\u061ctest',
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

  it.each([
    '\u061c',
    '\u200e',
    '\u200f',
    '\u202a',
    '\u202b',
    '\u202c',
    '\u202d',
    '\u202e',
    '\u2066',
    '\u2067',
    '\u2068',
    '\u2069',
  ])('sanitizes each Unicode bidi control: %j', (control) => {
    expect(
      parseForSaleRecords([`v=FORSALE1;ftxt=Hello${control}world`])?.texts,
    ).toEqual(['Hello world']);
    expect(
      parseForSaleRecords([
        `v=FORSALE1;furi=https://seller.example/${control}test`,
      ])?.links,
    ).toEqual([]);
  });

  it('ignores oversized records before recognizing a sale signal', () => {
    expect(
      parseForSaleRecords([`v=FORSALE1;ftxt=${'€'.repeat(100)}`]),
    ).toBeNull();
  });

  it('enforces the 255-octet boundary using UTF-8 byte length', () => {
    const text = `${'€'.repeat(79)}xx`;
    const record = `v=FORSALE1;ftxt=${text}`;
    expect(new TextEncoder().encode(record).length).toBe(255);
    expect(parseForSaleRecords([record])?.texts).toEqual([text]);
    expect(parseForSaleRecords([record + 'x'])).toBeNull();
  });

  it('keeps valid records when another answer is oversized', () => {
    expect(
      parseForSaleRecords([
        `v=FORSALE1;ftxt=${'x'.repeat(256)}`,
        'v=FORSALE1;fval=USD10',
      ])?.prices,
    ).toEqual(['USD 10']);
  });
});

describe('for-sale lookup', () => {
  const fetchMock = vi.fn();
  const answer = (
    data: string,
    TTL = 300,
    type = 16,
    name = '_for-sale.example.com.',
  ) => ({
    name,
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
      domain: 'example.com',
      listing: { prices: ['EUR 2500'], links: [], texts: [] },
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      'https://cloudflare-dns.com/dns-query?name=_for-sale.example.com&type=TXT',
    );
    expect(options.headers.Accept).toBe('application/dns-json');
    expect(options.cache).toBe('no-store');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('decodes escaped quotes, backslashes and UTF-8 octets', async () => {
    respond({
      Status: 0,
      Answer: [
        answer(
          String.raw`"v=FORSALE1;ftxt=Gr\195\188\195\159e \"friend\" \\ end"`,
        ),
      ],
    });
    expect((await lookupForSale('example.com')).listing?.texts).toEqual([
      'Grüße "friend" \\ end',
    ]);
  });

  it('handles plain TXT content for Atom listings', async () => {
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
    expect((await lookupForSale('example.com')).listing).toEqual({
      prices: ['USD 71256'],
      links: ['https://www.atom.com/name/recruitable?utm_source=forsale-dns'],
      texts: ['This domain is for sale on atom.com'],
    });
  });

  it('handles the email listing published by forsaledns.net', async () => {
    respond({
      Status: 0,
      Answer: [
        answer(
          '"v=FORSALE1;furi=mailto:sales@sun.com.py"',
          300,
          16,
          '_for-sale.forsaledns.net.',
        ),
        answer(
          '"v=FORSALE1;fval=USD195000"',
          300,
          16,
          '_for-sale.forsaledns.net.',
        ),
      ],
    });
    expect(await lookupForSale('forsaledns.net')).toEqual({
      domain: 'forsaledns.net',
      listing: {
        prices: ['USD 195000'],
        links: ['mailto:sales@sun.com.py'],
        texts: [],
      },
    });
    expect(fetchMock.mock.calls[0][0].searchParams.get('name')).toBe(
      '_for-sale.forsaledns.net',
    );
  });

  it.each([
    '"v=FORSALE1;ftxt=\\999"',
    '"v=FORSALE1;" garbage',
    '"v=FORSALE1;',
    '"v=FORSALE1;" "fval=USD10"',
    '"v=FOR" "SALE1;"',
  ])('ignores malformed presentation data: %s', async (data) => {
    respond({ Status: 0, Answer: [answer(data)] });
    expect((await lookupForSale('example.com')).listing).toBeNull();
  });

  it.each(['fcod', 'ftxt', 'furi', 'fval'])(
    'preserves the sale marker when %s contains invalid UTF-8',
    async (tag) => {
      respond({ Status: 0, Answer: [answer(`"v=FORSALE1;${tag}=\\255"`)] });
      expect((await lookupForSale('example.com')).listing).toEqual({
        prices: [],
        links: [],
        texts: [],
      });
    },
  );

  it('does not accept invalid UTF-8 in the version marker', async () => {
    respond({ Status: 0, Answer: [answer('"v=FORSALE\\255;fcod=opaque"')] });
    expect((await lookupForSale('example.com')).listing).toBeNull();
  });

  it('does not accept a UTF-8 byte order mark before the version marker', async () => {
    respond({
      Status: 0,
      Answer: [answer(String.raw`"\239\187\191v=FORSALE1;fval=USD1"`)],
    });
    expect((await lookupForSale('example.com')).listing).toBeNull();
  });

  it.each([
    `"v=FORSALE1;ftxt=${'x'.repeat(240)}"`,
    `"v=FORSALE1;ftxt=${String.raw`\195\188`.repeat(120)}"`,
    `"v=FORSALE1;fcod=${String.raw`\255`.repeat(240)}"`,
  ])(
    'ignores overlong quoted records, including invalid optional UTF-8',
    async (data) => {
      respond({ Status: 0, Answer: [answer(data)] });
      expect((await lookupForSale('example.com')).listing).toBeNull();
    },
  );

  it('accepts a quoted record at the 255-octet boundary', async () => {
    const text = 'x'.repeat(239);
    respond({ Status: 0, Answer: [answer(`"v=FORSALE1;ftxt=${text}"`)] });
    expect((await lookupForSale('example.com')).listing?.texts).toEqual([text]);
  });

  it.each([
    '51.198.in-addr.arpa',
    '0.1.ip6.arpa',
    '1.2.e164.arpa',
    'WWW.IN-ADDR.ARPA.',
  ])('skips infrastructure domains before querying DNS: %s', async (domain) => {
    expect((await lookupForSale(domain)).listing).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts answer sets at the processing limits', async () => {
    respond({
      Status: 0,
      Answer: Array.from({ length: 256 }, () =>
        answer(
          'v=FORSALE1;ftxt=' + 'x'.repeat(4096 - 'v=FORSALE1;ftxt='.length),
        ),
      ),
    });
    expect((await lookupForSale('example.com')).listing).toBeNull();
  });

  it.each(
    [
      Array.from({ length: 257 }, () => answer('v=FORSALE1;')),
      [answer('x'.repeat(4097))],
      [answer('€'.repeat(1366))],
    ].map((answers) => ({ answers })),
  )('rejects oversized DNS responses', async ({ answers }) => {
    respond({ Status: 0, Answer: answers });
    await expect(lookupForSale('example.com')).rejects.toThrow(
      'exceeds size limits',
    );
  });

  it('ignores non-TXT answers while preserving version-only listings', async () => {
    respond({
      Status: 0,
      Answer: [answer('alias.example.', 30, 5), answer('"v=FORSALE1;"', 7200)],
    });
    expect((await lookupForSale('example.com')).listing).toEqual({
      prices: [],
      links: [],
      texts: [],
    });
  });

  it.each([
    { Status: 0 },
    { Status: 3 },
    { Status: 3, Answer: [answer('"v=FORSALE1;"')] },
    { Status: 0, Answer: [answer('"unrelated TXT"')] },
  ])(
    'returns no listing for successful responses without a signal: %j',
    async (body) => {
      respond(body);
      expect(await lookupForSale('example.com')).toEqual({
        domain: 'example.com',
        listing: null,
      });
    },
  );

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
    await expect(lookupForSale('example.com')).rejects.toMatchObject({
      cause: { message: expect.stringContaining('HTTP 503') },
    });
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
