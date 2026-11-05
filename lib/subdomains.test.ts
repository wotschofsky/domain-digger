import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findSubdomains } from './subdomains';

const { execa } = vi.hoisted(() => ({ execa: vi.fn() }));
vi.mock('execa', () => ({ execa }));

const encodeDiscovery = (host: string) =>
  JSON.stringify({ host, sources: ['test'] });

describe('subdomain lookup budgets', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('keeps complete JSON discoveries and drops the truncated line when subfinder is killed at its deadline', async () => {
    execa.mockRejectedValue(
      Object.assign(new Error('timeout'), {
        timedOut: true,
        stdout: `${encodeDiscovery('a.example.com')}\n{"host":"unfinished`,
      }),
    );

    const resolveAnswers = vi
      .fn()
      .mockResolvedValue({ answers: [{ type: 1 }] });

    const result = await findSubdomains('example.com', () => ({
      resolveAnswers,
    }));

    expect(result.discoveryIncomplete).toBe(true);
    expect(result.results).toEqual([
      { domain: 'a.example.com', sources: ['test'], stillExists: true },
    ]);
    expect(execa.mock.calls[0][2]).toMatchObject({
      timeout: 35_000,
      killSignal: 'SIGKILL',
    });
  });

  it('recovers source-labelled stderr hosts when subfinder is killed before flushing JSON', async () => {
    execa.mockRejectedValue(
      Object.assign(new Error('timeout'), {
        timedOut: true,
        stdout: '',
        stderr:
          '[INF] Enumerating subdomains for example.com\n[crtsh] a.example.com\n[alienvault] a.example.com\n[crtsh] a.example.com\n[ERR] b.example.com\n[crtsh] unrelated.net\n[crtsh] invalid/path\n',
      }),
    );

    const resolveAnswers = vi.fn().mockResolvedValue({ answers: [] });
    const result = await findSubdomains('example.com', () => ({
      resolveAnswers,
    }));

    expect(result.discoveryIncomplete).toBe(true);
    expect(result.results).toEqual([
      {
        domain: 'a.example.com',
        sources: ['alienvault', 'crtsh'],
        stillExists: false,
      },
    ]);
    expect(execa.mock.calls[0][1]).toEqual(
      expect.arrayContaining(['-v', '-nc', '-duc']),
    );
    expect(execa.mock.calls[0][1]).not.toContain('-silent');
  });

  it('cancels stalled DNS checks at the deadline, runs at most 10 at once, and keeps every discovery', async () => {
    execa.mockResolvedValue({
      stdout: Array.from({ length: 30 }, (_, i) =>
        encodeDiscovery(`a${i}.example.com`),
      ).join('\n'),
    });

    let signal!: AbortSignal;
    const resolveAnswers = vi.fn(
      () =>
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    );

    const pending = findSubdomains('example.com', (value) => {
      signal = value;
      return { resolveAnswers };
    });

    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;

    expect(signal.aborted).toBe(true);
    expect(resolveAnswers).toHaveBeenCalledTimes(10);
    expect(result.results).toHaveLength(30);
    expect(result.results.every((item) => item.stillExists === null)).toBe(
      true,
    );
    expect(result.detailsReduced).toBe(true);
  });

  it('an empty DNS answer means the name is gone, a failed check means unknown', async () => {
    execa.mockResolvedValue({
      stdout: [
        encodeDiscovery('a.example.com'),
        encodeDiscovery('b.example.com'),
      ].join('\n'),
    });

    const resolveAnswers = vi
      .fn()
      .mockResolvedValueOnce({ answers: [] })
      .mockRejectedValueOnce(new Error('SERVFAIL'));

    const result = await findSubdomains('example.com', () => ({
      resolveAnswers,
    }));

    expect(result.results.map((item) => item.stillExists)).toEqual([
      false,
      null,
    ]);
  });

  it('a subfinder crash surfaces as an error, not an empty discovery', async () => {
    execa.mockRejectedValue(new Error('cannot execute'));

    await expect(findSubdomains('example.com')).rejects.toThrow(
      'Subdomain discovery failed',
    );
  });
});
