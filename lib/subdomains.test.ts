import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findSubdomains } from './subdomains';

const { execa } = vi.hoisted(() => ({ execa: vi.fn() }));
vi.mock('execa', () => ({ execa }));

const discovery = (host: string) => JSON.stringify({ host, sources: ['test'] });

describe('subdomain lookup budgets', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('retains complete discoveries when the subprocess times out', async () => {
    execa.mockRejectedValue(
      Object.assign(new Error('timeout'), {
        timedOut: true,
        stdout: `${discovery('a.example.com')}\n{"host":"unfinished`,
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

  it('cancels stalled checks, keeps discoveries, and limits concurrency', async () => {
    execa.mockResolvedValue({
      stdout: Array.from({ length: 30 }, (_, i) =>
        discovery(`a${i}.example.com`),
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

  it('distinguishes an empty DNS response from a failed DNS check', async () => {
    execa.mockResolvedValue({
      stdout: [discovery('a.example.com'), discovery('b.example.com')].join(
        '\n',
      ),
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

  it('does not hide a subprocess crash as an empty successful discovery', async () => {
    execa.mockRejectedValue(new Error('cannot execute'));
    await expect(findSubdomains('example.com')).rejects.toThrow(
      'Subdomain discovery failed',
    );
  });
});
