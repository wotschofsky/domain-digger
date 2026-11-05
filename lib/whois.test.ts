import type * as Whoiser from 'whoiser';
import { describe, expect, it, vi } from 'vitest';

import { UserFacingError } from './user-facing-error';
import { formatDate, lookupWhois } from './whois';

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
});
