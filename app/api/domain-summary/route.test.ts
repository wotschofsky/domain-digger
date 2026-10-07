import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const { lookupSale, lookupWhois, logger } = vi.hoisted(() => ({
  lookupSale: vi.fn(),
  lookupWhois: vi.fn(),
  logger: { set: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/for-sale', () => ({ lookupForSale: lookupSale }));
vi.mock('@/lib/whois', () => ({ getWhoisSummary: lookupWhois }));
vi.mock('@/lib/evlog', () => ({
  useLogger: () => logger,
  withEvlog: (handler: unknown) => handler,
}));

const whois = {
  registered: true,
  registrar: 'Example registrar',
  createdAt: '2020-01-01',
  dnssec: 'signed',
};
const sale = {
  domain: 'example.com',
  listing: { prices: ['EUR 2500'], links: [], texts: [] },
};
const request = (domain?: string) =>
  new Request(
    `https://digger.tools/api/domain-summary${domain === undefined ? '' : `?domain=${encodeURIComponent(domain)}`}`,
  );

describe('domain summary API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    lookupWhois.mockResolvedValue(whois);
    lookupSale.mockResolvedValue(sale);
  });

  it.each([undefined, '', 'bad/domain'])(
    'rejects invalid domains before starting either lookup: %s',
    async (domain) => {
      const response = await GET(request(domain));
      expect(response.status).toBe(400);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(lookupWhois).not.toHaveBeenCalled();
      expect(lookupSale).not.toHaveBeenCalled();
    },
  );

  it('returns both summaries with the existing WHOIS cache policy', async () => {
    const response = await GET(request('www.example.com'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ whois, sale });
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=600, s-maxage=1800',
    );
    expect(lookupWhois).toHaveBeenCalledWith('www.example.com');
    expect(lookupSale).toHaveBeenCalledWith('www.example.com');
  });

  it('also caches successful responses without a sale listing', async () => {
    const noListing = { domain: 'example.com', listing: null };
    lookupSale.mockResolvedValue(noListing);
    const response = await GET(request('example.com'));
    expect(await response.json()).toEqual({ whois, sale: noListing });
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=600, s-maxage=1800',
    );
  });

  it('preserves and caches the unregistered WHOIS result', async () => {
    lookupWhois.mockResolvedValue({ registered: false });
    const response = await GET(request('example.com'));
    expect(await response.json()).toEqual({
      whois: { registered: false },
      sale,
    });
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=600, s-maxage=1800',
    );
  });

  it.each(['WHOIS', 'sale'])(
    'fails the whole request without caching when the %s lookup rejects',
    async (lookup) => {
      const error = new Error('Lookup failed');
      (lookup === 'WHOIS' ? lookupWhois : lookupSale).mockRejectedValue(error);
      const response = await GET(request('example.com'));
      expect(response.status).toBe(500);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toEqual({
        error: true,
        message: 'Error fetching domain summary',
      });
      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledWith(error);
    },
  );

  it('starts both lookups before waiting for either to finish', async () => {
    let resolveWhois!: (value: typeof whois) => void;
    let resolveSale!: (value: typeof sale) => void;
    lookupWhois.mockReturnValue(
      new Promise((resolve) => {
        resolveWhois = resolve;
      }),
    );
    lookupSale.mockReturnValue(
      new Promise((resolve) => {
        resolveSale = resolve;
      }),
    );

    const responsePromise = GET(request('example.com'));
    expect(lookupWhois).toHaveBeenCalledOnce();
    expect(lookupSale).toHaveBeenCalledOnce();
    resolveWhois(whois);
    resolveSale(sale);
    expect(await (await responsePromise).json()).toEqual({ whois, sale });
  });
});
