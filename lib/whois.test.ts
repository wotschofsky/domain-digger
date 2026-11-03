import type * as Whoiser from 'whoiser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRdapSummary } from './rdap';
import { formatDate, getWhoisSummary } from './whois';

vi.mock('./rdap', () => ({ getRdapSummary: vi.fn().mockResolvedValue(null) }));

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRdapSummary).mockResolvedValue(null);
  });

  it('uses RDAP before WHOIS and preserves authoritative not-found results', async () => {
    vi.mocked(getRdapSummary).mockResolvedValue({ registered: false });
    expect(await getWhoisSummary('www.example.com')).toEqual({
      registered: false,
    });
    expect(getRdapSummary).toHaveBeenCalledWith('example.com');
    expect(whoisDomain).not.toHaveBeenCalled();
  });

  it('falls back to WHOIS when RDAP is unavailable', async () => {
    vi.mocked(getRdapSummary).mockRejectedValue(new Error('RDAP HTTP 503'));
    whoisDomain.mockResolvedValue({
      'whois.example': {
        Registrar: 'Fallback registrar',
        __raw: 'Domain Name: EXAMPLE.COM',
      },
    });
    expect(await getWhoisSummary('example.com')).toMatchObject({
      registered: true,
      registrar: 'Fallback registrar',
    });
  });

  it.each([
    'Query limit exceeded; not found in cache',
    '',
    'Too many requests; try again later',
  ])('keeps a declined or empty WHOIS response unknown: %s', async (raw) => {
    whoisDomain.mockResolvedValue({ 'whois.example': { __raw: raw } });
    expect(await getWhoisSummary('example.com')).toMatchObject({
      registered: true,
      unknown: true,
    });
  });

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
