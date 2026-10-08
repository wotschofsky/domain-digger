import type * as Whoiser from 'whoiser';
import { describe, expect, it, vi } from 'vitest';

import { formatDate, getWhoisSummary } from './whois';

const { whoisDomain } = vi.hoisted(() => ({ whoisDomain: vi.fn() }));
vi.mock('whoiser', async (importOriginal) => ({
  ...(await importOriginal<typeof Whoiser>()),
  whoisDomain,
}));

describe('formatDate', () => {
  it('formats a date as an ISO string without the time', () => {
    const date = new Date('2021-01-01T12:34:56Z');
    expect(formatDate(date)).toBe('2021-01-01');
  });
});

describe('getWhoisSummary', () => {
  it('marks registration as unknown when the lookup fails', async () => {
    whoisDomain.mockRejectedValue(new Error('timeout'));
    expect(await getWhoisSummary('example.com')).toEqual({
      registered: true,
      unknown: true,
      registrar: null,
      createdAt: null,
      dnssec: null,
    });
  });

  it('marks registration as unknown when the WHOIS server query errors', async () => {
    // whoiser resolves socket errors and timeouts instead of rejecting.
    whoisDomain.mockResolvedValue({ 'whois.example': { error: 'Timeout' } });
    expect(await getWhoisSummary('example.com')).toMatchObject({
      registered: true,
      unknown: true,
    });
  });

  it('does not mark a parsed result as unknown', async () => {
    whoisDomain.mockResolvedValue({
      'whois.example': { Registrar: 'Example registrar', __raw: 'ok' },
    });
    expect(await getWhoisSummary('example.com')).toEqual({
      registered: true,
      registrar: 'Example registrar',
      createdAt: null,
      dnssec: null,
    });
  });
});
