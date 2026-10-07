import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLunarClient, lunarExposureSchema } from './lunar';
import { UserFacingError } from './user-facing-error';

const ready = (domain = 'example.com') => ({
  requestUuid: 'synthetic-request-id',
  domain,
  periodFrom: '2025-10-01',
  periodTo: '2026-09-30',
  status: 'REPORT_READY',
  report: {
    domain,
    generated_at: '2026-10-01T23:00:57.235519337',
    period: { from: '2025-10-01', to: '2026-09-30' },
    summary: {
      total_events: 12,
      infostealer_events: 2,
      data_breach_events: 10,
      employee_events: 3,
      client_events: 9,
      first_seen: '2025-10-01',
      last_seen: '2026-09-30',
    },
    malware_family_breakdown: [{ family: 'Redline', events: 2 }],
    service_classification_breakdown: [{ service: 'Microsoft', events: 2 }],
    os_breakdown: [{ os_family: 'Windows 11', infostealer_events: 2 }],
    antivirus_breakdown: [],
  },
});

const generating = {
  requestUuid: 'synthetic-pending-request',
  domain: 'example.com',
  status: 'GENERATING_REPORT',
  report: null,
};

describe('Lunar exposure client', () => {
  const fetcher = vi.fn<typeof fetch>();
  let lookup: ReturnType<typeof createLunarClient>;

  beforeEach(() => {
    fetcher.mockReset();
    lookup = createLunarClient(fetcher);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes the exact domain and queries the fixed endpoint without a token', async () => {
    fetcher.mockResolvedValue(Response.json(ready()));
    const result = await lookup(' EXAMPLE.COM. ');
    expect(result.status).toBe('REPORT_READY');
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.lunarcyber.com/domain-exposure?domain=example.com',
      {
        signal: expect.any(AbortSignal),
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      },
    );
  });

  it('supports IDNs and does not broaden subdomains', async () => {
    fetcher.mockResolvedValueOnce(Response.json(ready('xn--bcher-kva.de')));
    await lookup('bücher.de');
    fetcher.mockResolvedValueOnce(Response.json(ready('login.example.com')));
    await lookup('login.example.com');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.lunarcyber.com/domain-exposure?domain=xn--bcher-kva.de',
      'https://api.lunarcyber.com/domain-exposure?domain=login.example.com',
    ]);
  });

  it.each([
    '',
    'com',
    '*.example.com',
    '_service.example.com',
    '127.0.0.1',
    'https://example.com',
    'example.com&domain=other.com',
  ])('rejects invalid input %j before fetching', async (input) => {
    await expect(lookup(input)).rejects.toMatchObject({
      payload: { title: 'Invalid exposure domain' },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('caches ready reports for an hour using the normalized domain key', async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation(async () => Response.json(ready()));
    await lookup('example.com');
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 - 1);
    await lookup('EXAMPLE.COM.');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await lookup('example.com');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent requests', async () => {
    let resolve!: (response: Response) => void;
    fetcher.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const first = lookup('example.com');
    const second = lookup('EXAMPLE.COM.');
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve(Response.json(ready()));
    expect(await first).toEqual(await second);
  });

  it('bounds the cache and evicts the oldest report', async () => {
    fetcher.mockImplementation(async (url) =>
      Response.json(ready(new URL(String(url)).searchParams.get('domain')!)),
    );
    for (let i = 0; i < 129; i++) await lookup(`domain${i}.com`);
    await lookup('domain128.com');
    expect(fetcher).toHaveBeenCalledTimes(129);
    await lookup('domain0.com');
    expect(fetcher).toHaveBeenCalledTimes(130);
  });

  it('does not cache pending reports and can retrieve the completed report', async () => {
    fetcher.mockResolvedValueOnce(Response.json(generating));
    fetcher.mockResolvedValueOnce(Response.json(ready()));
    expect((await lookup('example.com')).status).toBe('GENERATING_REPORT');
    expect((await lookup('example.com')).status).toBe('REPORT_READY');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('preserves a blocked-domain status without pretending there are zero events', async () => {
    fetcher.mockImplementation(async () =>
      Response.json({ status: 'NOT_AUTHORIZED' }),
    );
    expect((await lookup('example.com')).status).toBe('NOT_AUTHORIZED');
    await lookup('example.com');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('accepts zero events with null dates and absent optional context', async () => {
    const response = ready();
    const data = {
      ...response,
      report: {
        domain: response.domain,
        generated_at: response.report.generated_at,
        period: response.report.period,
        summary: {
          total_events: 0,
          infostealer_events: 0,
          data_breach_events: 0,
          employee_events: 0,
          client_events: 0,
          first_seen: null,
          last_seen: null,
        },
      },
    };
    fetcher.mockResolvedValue(Response.json(data));
    expect(await lookup('example.com')).toEqual(data);
  });

  it('ignores additive upstream fields', () => {
    const response = ready();
    const parsed = lunarExposureSchema.parse({
      ...response,
      newField: true,
      report: { ...response.report, newBreakdown: [] },
    });
    expect(parsed).toEqual(response);
  });

  it.each([
    { ...ready(), status: 'UNKNOWN_STATUS' },
    { ...ready(), report: null },
    { status: 'REPORT_READY' },
    { ...ready(), domain: 'other.com' },
    { ...ready(), report: { ...ready().report, domain: 'other.com' } },
    { ...ready(), periodFrom: '2024-10-01' },
    {
      ...ready(),
      report: {
        ...ready().report,
        summary: { ...ready().report.summary, total_events: -1 },
      },
    },
    {
      ...ready(),
      report: {
        ...ready().report,
        summary: { ...ready().report.summary, client_events: '9' },
      },
    },
    {
      ...ready(),
      report: {
        ...ready().report,
        summary: { ...ready().report.summary, first_seen: '2026-02-30' },
      },
    },
    {
      ...ready(),
      report: {
        ...ready().report,
        os_breakdown: [{ os_family: 'Windows', infostealer_events: 1.5 }],
      },
    },
  ])(
    'rejects malformed or mismatched reports without caching them (%#)',
    async (data) => {
      fetcher.mockResolvedValueOnce(Response.json(data));
      fetcher.mockResolvedValueOnce(Response.json(ready()));
      await expect(lookup('example.com')).rejects.toMatchObject({
        payload: { title: 'Invalid Lunar response', retryable: true },
      });
      expect((await lookup('example.com')).status).toBe('REPORT_READY');
    },
  );

  it('rejects non-JSON bodies without caching them', async () => {
    fetcher.mockResolvedValueOnce(new Response('<html>upstream error</html>'));
    fetcher.mockResolvedValueOnce(Response.json(ready()));
    await expect(lookup('example.com')).rejects.toBeInstanceOf(UserFacingError);
    await lookup('example.com');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, false],
    [401, false],
    [403, false],
    [404, false],
    [408, true],
    [429, true],
    [500, true],
    [503, true],
  ])('handles HTTP %i with retryable=%s', async (status, retryable) => {
    fetcher.mockResolvedValueOnce(
      new Response(null, { status: Number(status) }),
    );
    fetcher.mockResolvedValueOnce(Response.json(ready()));
    await expect(lookup('example.com')).rejects.toMatchObject({
      payload: { retryable },
    });
    await lookup('example.com');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('cleans up failed concurrent requests so a retry can succeed', async () => {
    fetcher.mockRejectedValueOnce(new Error('offline'));
    const results = await Promise.allSettled([
      lookup('example.com'),
      lookup('example.com'),
    ]);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(Response.json(ready()));
    await lookup('example.com');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('aborts a stalled request after eight seconds', async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          );
        }),
    );
    const assertion = expect(lookup('example.com')).rejects.toMatchObject({
      payload: { title: "Couldn't reach Lunar", retryable: true },
    });
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the deadline active for a stalled response body', async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation(
      async (_url, init) =>
        ({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              init!.signal!.addEventListener(
                'abort',
                () => reject(new Error('body aborted')),
                { once: true },
              );
            }),
        }) as Response,
    );
    const assertion = expect(lookup('example.com')).rejects.toMatchObject({
      payload: { title: 'Invalid Lunar response', retryable: true },
    });
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
