import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const { getDomainSummary, logger } = vi.hoisted(() => ({
  getDomainSummary: vi.fn(),
  logger: { set: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/domain-summary', () => ({ getDomainSummary }));
vi.mock('@/lib/evlog', () => ({
  useLogger: () => logger,
  withEvlog: (handler: unknown) => handler,
}));

const tiles = {
  status: 'registered',
  registrar: 'Example registrar',
  createdAt: '2020-01-01',
  dnssec: 'signed',
  sale: { fallbackDomain: null, prices: ['€2,500'], link: null },
};
const request = (domain?: string) =>
  new Request(
    `https://digger.tools/api/domain-summary${domain === undefined ? '' : `?domain=${encodeURIComponent(domain)}`}`,
  );

describe('domain summary API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getDomainSummary.mockResolvedValue({
      tiles,
      complete: true,
      saleError: null,
    });
  });

  it.each([undefined, '', 'bad/domain'])(
    'rejects invalid domains before looking anything up: %s',
    async (domain) => {
      const response = await GET(request(domain));
      expect(response.status).toBe(400);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(getDomainSummary).not.toHaveBeenCalled();
    },
  );

  it('returns the tiles, cached for long when both lookups answered', async () => {
    const response = await GET(request('www.example.com'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(tiles);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=600, s-maxage=1800',
    );
    expect(getDomainSummary).toHaveBeenCalledWith('www.example.com');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('caches briefly and logs a failed sale lookup', async () => {
    const error = new Error('Lookup failed');
    getDomainSummary.mockResolvedValue({
      tiles,
      complete: false,
      saleError: error,
    });
    const response = await GET(request('example.com'));
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=60, s-maxage=60',
    );
    expect(logger.set).toHaveBeenCalledWith({ event: 'sale_lookup_failed' });
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(error);
  });
});
