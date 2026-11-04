import { describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const { details, reverse } = vi.hoisted(() => ({
  details: vi.fn(),
  reverse: vi.fn(),
}));

vi.mock('@/lib/ips', () => ({ getIpDetails: details, lookupReverse: reverse }));

vi.mock('@/lib/evlog', () => ({
  withEvlog: (handler: unknown) => handler,
  useLogger: () => ({ set: vi.fn() }),
}));

describe('IP lookup scope validation', () => {
  it('rejects device-local interface IDs before making network requests', async () => {
    const response = await GET(
      new Request('https://digger.tools/api/ip-details?ip=fe80%3A%3A1%25lo0'),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain('Interface-scoped');
    expect(details).not.toHaveBeenCalled();
    expect(reverse).not.toHaveBeenCalled();
  });
});
