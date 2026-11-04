import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserFacingError } from '@/lib/user-facing-error';

import { GET } from './route';

const { lookupSale, lookupWhois, resolveDs, logger, log } = vi.hoisted(() => ({
  lookupSale: vi.fn(),
  lookupWhois: vi.fn(),
  resolveDs: vi.fn(),
  logger: { set: vi.fn(), error: vi.fn() },
  log: { warn: vi.fn() },
}));
vi.mock('@/lib/for-sale', () => ({ lookupForSale: lookupSale }));
vi.mock('@/lib/whois', () => ({ getWhoisSummary: lookupWhois }));

vi.mock('@/lib/resolvers/authoritative', () => ({
  AuthoritativeResolver: class {
    resolveAnswers = resolveDs;
  },
}));

vi.mock('@/lib/evlog', () => ({
  useLogger: () => logger,
  log,
  withEvlog: (handler: unknown) => handler,
}));

const whois = {
  registered: true,
  registrar: 'Example registrar',
  createdAt: '2020-01-01',
};
const sale = {
  domain: 'example.com',
  listing: { prices: ['EUR 2500'], links: [], texts: [] },
};

const dsAnswer = {
  name: 'example.com',
  type: 'DS',
  data: {
    keyTag: 2371,
    algorithm: 13,
    digestType: 2,
    digest: Buffer.alloc(32),
  },
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

    resolveDs.mockResolvedValue({
      answers: [dsAnswer],
      trace: [],
      zone: 'com',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([undefined, '', 'bad/domain'])(
    'rejects invalid domains before starting either lookup: %s',
    async (domain) => {
      const response = await GET(request(domain));
      expect(response.status).toBe(400);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(lookupWhois).not.toHaveBeenCalled();
      expect(lookupSale).not.toHaveBeenCalled();
      expect(resolveDs).not.toHaveBeenCalled();
    },
  );

  it('returns all summaries with the existing WHOIS cache policy', async () => {
    const response = await GET(request('www.example.com'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ whois, dnssec: true, sale });

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=600, s-maxage=1800',
    );

    expect(lookupWhois).toHaveBeenCalledWith('www.example.com');
    expect(lookupSale).toHaveBeenCalledWith('www.example.com');
    expect(resolveDs).toHaveBeenCalledWith('example.com', 'DS');
  });

  it('reports an empty DS answer as unsigned and caches it', async () => {
    resolveDs.mockResolvedValue({ answers: [], trace: [], zone: 'com' });
    const response = await GET(request('example.com'));
    expect(await response.json()).toEqual({ whois, dnssec: false, sale });

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=600, s-maxage=1800',
    );
  });

  it('keeps the summary with a short cache when the DS servers do not answer', async () => {
    const error = new UserFacingError({
      title: 'Authoritative DNS servers did not answer',
      description: 'Every available authoritative nameserver failed.',
      retryable: true,
    });

    resolveDs.mockRejectedValue(error);
    const response = await GET(request('example.com'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ whois, dnssec: null, sale });

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=60, s-maxage=60',
    );

    expect(log.warn).toHaveBeenCalledWith({
      message: 'ds_lookup_failed',
      domain: 'example.com',
      error,
    });

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.set).toHaveBeenCalledWith({ whois, dnssec: null });
  });

  it('reports an unexpected DS lookup failure as an error', async () => {
    const error = new Error('Lookup failed');
    resolveDs.mockRejectedValue(error);
    const response = await GET(request('example.com'));
    expect(await response.json()).toEqual({ whois, dnssec: null, sale });
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(error);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('gives up on a hanging DS lookup at its deadline', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    resolveDs.mockReturnValue(new Promise(() => {}));
    let settled = false;

    const responsePromise = GET(request('example.com')).finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(4999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const response = await responsePromise;
    expect(await response.json()).toEqual({ whois, dnssec: null, sale });

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=60, s-maxage=60',
    );

    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'ds_lookup_failed',
        error: expect.objectContaining({ message: 'DS lookup timed out' }),
      }),
    );

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('also caches successful responses without a sale listing', async () => {
    const noListing = { domain: 'example.com', listing: null };
    lookupSale.mockResolvedValue(noListing);
    const response = await GET(request('example.com'));

    expect(await response.json()).toEqual({
      whois,
      dnssec: true,
      sale: noListing,
    });

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=600, s-maxage=1800',
    );
  });

  it('preserves and caches the unregistered WHOIS result', async () => {
    lookupWhois.mockResolvedValue({ registered: false });
    const response = await GET(request('example.com'));

    expect(await response.json()).toEqual({
      whois: { registered: false },
      dnssec: true,
      sale,
    });

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=600, s-maxage=1800',
    );
  });

  it('fails the request without caching when the WHOIS lookup rejects', async () => {
    const error = new Error('Lookup failed');
    lookupWhois.mockRejectedValue(error);
    const response = await GET(request('example.com'));
    expect(response.status).toBe(500);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: true,
      message: 'Error fetching domain summary',
    });
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(error);
  });

  it('keeps WHOIS with a short cache when the sale lookup rejects', async () => {
    const error = new Error('Lookup failed');
    lookupSale.mockRejectedValue(error);
    const response = await GET(request('example.com'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ whois, dnssec: true, sale: null });
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=60, s-maxage=60',
    );
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(error);
  });

  it('uses the short cache when WHOIS registration is unknown', async () => {
    const unknown = { ...whois, unknown: true };
    lookupWhois.mockResolvedValue(unknown);
    const response = await GET(request('example.com'));

    expect(await response.json()).toEqual({
      whois: unknown,
      dnssec: true,
      sale,
    });

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=60, s-maxage=60',
    );
  });

  it('starts all lookups before waiting for any to finish', async () => {
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
    expect(resolveDs).toHaveBeenCalledOnce();
    resolveWhois(whois);
    resolveSale(sale);

    expect(await (await responsePromise).json()).toEqual({
      whois,
      dnssec: true,
      sale,
    });
  });
});
