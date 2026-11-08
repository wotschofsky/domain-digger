import type * as Whoiser from 'whoiser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const { whoisDomain, logger } = vi.hoisted(() => ({
  whoisDomain: vi.fn(),
  logger: { set: vi.fn(), error: vi.fn() },
}));
vi.mock('whoiser', async (importOriginal) => ({
  ...(await importOriginal<typeof Whoiser>()),
  whoisDomain,
}));
vi.mock('@/lib/evlog', () => ({
  useLogger: () => logger,
  withEvlog: (handler: unknown) => handler,
}));

const fetchMock = vi.fn();
// Answer each _for-sale name from its records; other names do not exist.
const listings = (records: Record<string, string[]>) =>
  fetchMock.mockImplementation(async (url: URL) => {
    const name = url.searchParams.get('name')!;
    const answers = records[name.replace(/^_for-sale\./, '')];
    return new Response(
      JSON.stringify(
        answers
          ? {
              Status: 0,
              Answer: answers.map((data) => ({
                name: `${name}.`,
                type: 16,
                TTL: 300,
                data,
              })),
            }
          : { Status: 3 },
      ),
    );
  });

const verisign = (fields: Record<string, string>) =>
  whoisDomain.mockResolvedValue({
    'whois.verisign-grs.com': { ...fields, __raw: 'Domain Name: EXAMPLE.COM' },
  });

const summary = async (domain?: string) => {
  const response = await GET(
    new Request(
      `https://digger.tools/api/domain-summary${domain === undefined ? '' : `?domain=${encodeURIComponent(domain)}`}`,
    ),
  );
  return {
    status: response.status,
    cache: response.headers.get('Cache-Control'),
    tiles: await response.json(),
  };
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  verisign({ Registrar: 'Example Registrar, Inc.' });
  listings({});
});
afterEach(() => vi.unstubAllGlobals());

describe('domain summary API', () => {
  it.each([undefined, '', 'bad/domain'])(
    'rejects invalid domains before looking anything up: %s',
    async (domain) => {
      expect(await summary(domain)).toMatchObject({
        status: 400,
        cache: 'no-store',
      });
      expect(whoisDomain).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('shows the registry’s fields for a registered domain, cached for long', async () => {
    verisign({
      Registrar: 'Example Registrar, Inc.',
      'Created Date': '1995-08-14T04:00:00Z',
      DNSSEC: 'signedDelegation',
    });
    expect(await summary('www.example.com')).toEqual({
      status: 200,
      cache: 'public, max-age=600, s-maxage=1800',
      tiles: {
        status: 'registered',
        registrar: 'Example Registrar, Inc.',
        createdAt: '1995-08-14',
        dnssec: 'signedDelegation',
        sale: null,
      },
    });
    expect(whoisDomain).toHaveBeenCalledWith('example.com', expect.anything());
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('shows fields the registry leaves out as not listed', async () => {
    whoisDomain.mockResolvedValue({
      'whois.denic.de': {
        'Domain Name': 'example.de',
        __raw: 'Domain: example.de\nStatus: connect',
      },
    });
    expect(await summary('example.de')).toMatchObject({
      cache: 'public, max-age=600, s-maxage=1800',
      tiles: {
        status: 'registered',
        registrar: 'Not listed',
        createdAt: 'Not listed',
        dnssec: 'Not listed',
      },
    });
  });

  it.each([
    ['rejects', () => whoisDomain.mockRejectedValue(new Error('Timeout'))],
    [
      'resolves a server error',
      () =>
        whoisDomain.mockResolvedValue({
          'whois.verisign-grs.com': { error: 'Timeout' },
        }),
    ],
  ])(
    'reads unavailable, without a sale tile, briefly cached when WHOIS %s',
    async (_, fail) => {
      fail();
      listings({ 'example.com': ['v=FORSALE1;fval=EUR2500'] });
      expect(await summary('example.com')).toEqual({
        status: 200,
        cache: 'public, max-age=60, s-maxage=60',
        tiles: {
          status: 'unknown',
          registrar: 'Unavailable',
          createdAt: 'Unavailable',
          dnssec: 'Unavailable',
          sale: null,
        },
      });
    },
  );

  it('shows an unregistered domain without a sale tile', async () => {
    whoisDomain.mockResolvedValue({
      'whois.verisign-grs.com': { __raw: 'No match for "EXAMPLE.COM".' },
    });
    listings({ 'example.com': ['v=FORSALE1;fval=EUR2500'] });
    expect(await summary('example.com')).toEqual({
      status: 200,
      cache: 'public, max-age=600, s-maxage=1800',
      tiles: { status: 'unregistered' },
    });
  });

  it('keeps WHOIS, caches briefly and logs when the sale lookup fails', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 2 })));
    expect(await summary('example.com')).toMatchObject({
      cache: 'public, max-age=60, s-maxage=60',
      tiles: { registrar: 'Example Registrar, Inc.', sale: null },
    });
    expect(logger.set).toHaveBeenCalledWith({ event: 'sale_lookup_failed' });
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
  });

  it.each([
    ['example.com', 'example.com', null],
    ['Example.COM.', 'example.com', null],
    ['*.example.com', 'example.com', null],
    ['shop.example.com', 'shop.example.com', null],
    ['www.example.com', 'example.com', 'example.com'],
    ['*.www.example.com', 'example.com', 'example.com'],
  ])(
    'names the fallback domain for a search of %s listed on %s',
    async (domain, listedOn, fallbackDomain) => {
      listings({ [listedOn]: ['v=FORSALE1;'] });
      expect((await summary(domain)).tiles).toMatchObject({
        sale: { fallbackDomain, prices: [], link: null },
      });
    },
  );

  it('formats each advertised price', async () => {
    listings({
      'example.com': ['v=FORSALE1;fval=USD195000', 'v=FORSALE1;fval=EUR2500'],
    });
    expect((await summary('example.com')).tiles).toMatchObject({
      sale: { prices: ['€2,500', '$195,000'] },
    });
  });

  it.each([
    [
      ['mailto:seller@example.com', 'https://seller.example/buy', 'tel:+4930'],
      'https://seller.example/buy',
    ],
    [['tel:+4930', 'mailto:seller@example.com'], 'mailto:seller@example.com'],
    [['tel:+4930'], null],
  ])('links one actionable listing out of %j', async (links, link) => {
    listings({
      'example.com': links.map((link) => `v=FORSALE1;furi=${link}`),
    });
    expect((await summary('example.com')).tiles).toMatchObject({
      sale: { link },
    });
  });
});
