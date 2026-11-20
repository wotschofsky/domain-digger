import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lookupCerts, lookupRelatedCerts } from './certs';

vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));

const certificate = {
  id: 1,
  issuer_ca_id: 1,
  issuer_name: 'CA',
  common_name: 'www.example.com',
  name_value: 'www.example.com\n*.example.com',
  entry_timestamp: '2026-01-01',
  not_before: '2026-01-01',
  not_after: '2026-04-01',
  serial_number: '01',
};

const fetchMock = vi.fn<typeof fetch>();

describe('certificate lookup resilience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('one failed crt.sh query keeps the other results and marks them incomplete', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json([certificate]))
      .mockResolvedValueOnce(new Response('', { status: 503 }));

    await expect(lookupRelatedCerts('www.example.com')).resolves.toEqual({
      certs: [certificate],
      incomplete: true,
    });
  });

  it('throws when every upstream query fails rather than claiming no certificates', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }));

    await expect(lookupRelatedCerts('example.com')).rejects.toThrow(
      'crt.sh is unavailable',
    );
  });

  it('the deadline aborts a stalled body read, not only connection setup', async () => {
    let signal!: AbortSignal;

    fetchMock.mockImplementation(async (_url, options) => {
      signal = options!.signal as AbortSignal;
      return {
        ok: true,
        json: () =>
          new Promise((_, reject) =>
            signal.addEventListener('abort', () => reject(signal.reason), {
              once: true,
            }),
          ),
      } as Response;
    });

    const pending = expect(lookupCerts('example.com')).rejects.toThrow(
      "Couldn't complete the crt.sh lookup",
    );

    await vi.advanceTimersByTimeAsync(20_000);
    await pending;

    expect(signal.aborted).toBe(true);
  });

  it('accepts crt.sh rows without entry_timestamp, which its JSON no longer returns', async () => {
    const row = { ...certificate, entry_timestamp: undefined, result_count: 1 };
    fetchMock.mockResolvedValueOnce(Response.json([row]));

    await expect(lookupCerts('example.com')).resolves.toHaveLength(1);
  });

  it('rejects malformed data and deduplicates successful related queries', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'rate limited' }));
    await expect(lookupCerts('example.com')).rejects.toThrow();

    fetchMock.mockImplementation(async () => Response.json([certificate]));

    await expect(lookupRelatedCerts('www.example.com')).resolves.toEqual({
      certs: [certificate],
      incomplete: false,
    });
  });
});
