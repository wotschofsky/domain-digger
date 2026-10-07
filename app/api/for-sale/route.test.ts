import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const { lookup, logger } = vi.hoisted(() => ({
  lookup: vi.fn(),
  logger: { set: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/for-sale', () => ({ lookupForSale: lookup }));
vi.mock('@/lib/evlog', () => ({
  useLogger: () => logger,
  withEvlog: (handler: unknown) => handler,
}));

const request = (domain?: string) =>
  new Request(
    `https://digger.tools/api/for-sale${domain === undefined ? '' : `?domain=${encodeURIComponent(domain)}`}`,
  );

describe('for-sale API', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([undefined, '', 'bad/domain'])(
    'rejects invalid domains: %s',
    async (domain) => {
      const response = await GET(request(domain));
      expect(response.status).toBe(400);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it('returns a sale signal with DNS TTL-based caching', async () => {
    const summary = {
      domain: 'example.com',
      listing: { prices: ['EUR 2500'], links: [], texts: [] },
    };
    lookup.mockResolvedValue({ summary, ttl: 30 });
    const response = await GET(request('www.example.com'));
    expect(await response.json()).toEqual(summary);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=30, s-maxage=30',
    );
    expect(lookup).toHaveBeenCalledWith('www.example.com');
  });

  it('does not cache missing signals', async () => {
    lookup.mockResolvedValue({
      summary: { domain: 'example.com', listing: null },
      ttl: 0,
    });
    const response = await GET(request('example.com'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns a non-cacheable error for lookup failures', async () => {
    lookup.mockRejectedValue(new Error('Timeout'));
    const response = await GET(request('example.com'));
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: true,
      message: 'Sale information unavailable',
    });
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
