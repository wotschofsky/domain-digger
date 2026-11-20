import type * as Whoiser from 'whoiser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRdapSummary } from './rdap';
import { UserFacingError } from './user-facing-error';
import { getWhoisOutcome, lookupWhois } from './whois';

vi.mock('./rdap', () => ({ getRdapSummary: vi.fn().mockResolvedValue(null) }));

const { whoisDomain } = vi.hoisted(() => ({ whoisDomain: vi.fn() }));
vi.mock('whoiser', async (importOriginal) => ({
  ...(await importOriginal<typeof Whoiser>()),
  whoisDomain,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRdapSummary).mockResolvedValue(null);
});

describe('getWhoisOutcome', () => {
  it('uses RDAP before WHOIS and preserves authoritative not-found results', async () => {
    vi.mocked(getRdapSummary).mockResolvedValue({ status: 'unregistered' });

    expect(await getWhoisOutcome('www.example.com')).toEqual({
      status: 'unregistered',
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

    expect(await getWhoisOutcome('example.com')).toMatchObject({
      status: 'registered',
      registrar: 'Fallback registrar',
    });
  });

  it.each([
    'Query limit exceeded; not found in cache',
    '',
    'Too many requests; try again later',
  ])('keeps a declined or empty WHOIS response unknown: %s', async (raw) => {
    whoisDomain.mockResolvedValue({ 'whois.example': { __raw: raw } });

    expect(await getWhoisOutcome('example.com')).toEqual({
      status: 'unknown',
    });
  });

  it('does not read a domain named like a rate-limit notice as declined', async () => {
    whoisDomain.mockResolvedValue({
      'whois.example': {
        Registrar: 'Example registrar',
        __raw: 'Domain Name: RATELIMIT.COM\nRegistrar: Example registrar',
      },
    });

    expect(await getWhoisOutcome('ratelimit.com')).toEqual({
      status: 'registered',
      registrar: 'Example registrar',
      createdAt: null,
      dnssec: null,
    });

    whoisDomain.mockResolvedValue({
      'whois.example': { __raw: 'No match for "RATELIMIT.COM".' },
    });

    expect(await getWhoisOutcome('ratelimit.com')).toEqual({
      status: 'unregistered',
    });
  });
});

describe('lookupWhois', () => {
  it('fails retryably when every WHOIS server errored', async () => {
    // whoiser resolves socket errors and timeouts instead of rejecting.
    whoisDomain.mockResolvedValue({ 'whois.example': { error: 'Timeout' } });
    const lookup = lookupWhois('example.com');
    await expect(lookup).rejects.toBeInstanceOf(UserFacingError);
    await expect(lookup).rejects.toMatchObject({
      payload: { title: 'WHOIS lookup failed', retryable: true },
    });
  });

  it('keeps a record whose own domain name matches the decline pattern', async () => {
    const raw = 'Domain Name: RATE-LIMIT.COM\nRegistrar: Example registrar';
    whoisDomain.mockResolvedValue({ 'whois.example': { __raw: raw } });

    expect(await lookupWhois('rate-limit.com')).toEqual([
      ['whois.example', raw],
    ]);
  });

  it('returns no results for a blank response', async () => {
    whoisDomain.mockResolvedValue({ 'whois.example': { __raw: '\r\n ' } });

    expect(await lookupWhois('example.com')).toEqual([]);
  });

  it('surfaces a retryable error for a declined response', async () => {
    whoisDomain.mockResolvedValue({
      'whois.example': { __raw: 'Query limit exceeded; try again later' },
    });

    await expect(lookupWhois('example.com')).rejects.toMatchObject({
      payload: { title: 'WHOIS lookup failed', retryable: true },
    });
  });
});
