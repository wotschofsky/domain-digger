import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDnssecSummary } from './summary';

const { resolveAnswers, options } = vi.hoisted(() => ({
  resolveAnswers: vi.fn(),
  options: vi.fn(),
}));
vi.mock('@/lib/resolvers/cloudflare', () => ({
  CloudflareDoHResolver: class {
    constructor(value: unknown) {
      options(value);
    }
    resolveAnswers = resolveAnswers;
  },
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('DNSSEC delegation summary', () => {
  it('queries DS for the registrable domain, including multi-label suffixes', async () => {
    resolveAnswers.mockResolvedValue({
      answers: [{ type: 43, name: 'example.co.uk.' }],
    });
    await expect(getDnssecSummary('www.example.co.uk')).resolves.toEqual({
      domain: 'example.co.uk',
      status: 'ds-present',
    });
    expect(resolveAnswers).toHaveBeenCalledWith('example.co.uk', 'DS');
  });
  it('distinguishes absent DS from a resolver failure and ignores unrelated answers', async () => {
    resolveAnswers.mockResolvedValue({
      answers: [{ type: 43, name: 'other.com.' }],
    });
    expect((await getDnssecSummary('example.com')).status).toBe('no-ds');
    resolveAnswers.mockRejectedValue(new Error('SERVFAIL'));
    expect((await getDnssecSummary('example.com')).status).toBe('unavailable');
  });
  it('cancels a stalled request within the summary budget', async () => {
    vi.useFakeTimers();
    resolveAnswers.mockImplementation(
      () =>
        new Promise((_, reject) => {
          const { signal } = options.mock.calls[0][0];
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const pending = getDnssecSummary('example.com');
    await vi.advanceTimersByTimeAsync(3_000);
    expect((await pending).status).toBe('unavailable');
    expect(options.mock.calls[0][0].signal.aborted).toBe(true);
  });
});
