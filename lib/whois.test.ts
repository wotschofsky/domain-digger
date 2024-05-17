import { describe, expect, it } from 'vitest';

import { formatDate } from './whois';

describe('formatDate', () => {
  it('formats a date as an ISO string without the time', () => {
    const date = new Date('2021-01-01T12:34:56Z');
    expect(formatDate(date)).toBe('2021-01-01');
  });
});
