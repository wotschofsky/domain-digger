// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserFacingError } from '@/lib/user-facing-error';

const getIpDetails = vi.fn();
const lookupReverse = vi.fn();

vi.mock('@/env', () => ({
  env: { SITE_URL: 'https://example.com', NODE_ENV: 'test' },
}));

vi.mock('@/lib/ips', () => ({
  getIpDetails: (...args: unknown[]) => getIpDetails(...args),
  lookupReverse: (...args: unknown[]) => lookupReverse(...args),
}));

const { GET } = await import('./route');

const call = (ip: string) =>
  GET(new Request(`http://localhost/api/ip-details?ip=${ip}`));

describe('GET /api/ip-details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the details on a successful lookup', async () => {
    getIpDetails.mockResolvedValue({
      city: 'Amsterdam',
      country: 'Netherlands',
      isp: 'Example ISP',
    });
    lookupReverse.mockResolvedValue(['example.com']);

    const response = await call('8.8.8.8');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      city: 'Amsterdam',
      reverse: ['example.com'],
    });
  });

  it('passes an expected lookup failure on with a 4xx instead of a 500', async () => {
    getIpDetails.mockRejectedValue(
      new UserFacingError({
        title: "Couldn't look up this IP address",
        description: 'ip-api.com could not resolve this address: private range',
      }),
    );
    lookupReverse.mockResolvedValue([]);

    const response = await call('192.168.1.1');

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      title: "Couldn't look up this IP address",
      description: expect.stringContaining('private range'),
    });
  });

  it('uses 503 when the failure is worth retrying', async () => {
    getIpDetails.mockRejectedValue(
      new UserFacingError({
        title: "Couldn't reach ip-api.com",
        description: 'Please try again shortly.',
        retryable: true,
      }),
    );
    lookupReverse.mockResolvedValue([]);

    const response = await call('8.8.8.8');

    expect(response.status).toBe(503);
  });

  it('still rejects an invalid address with 400', async () => {
    const response = await call('not-an-ip');

    expect(response.status).toBe(400);
    expect(getIpDetails).not.toHaveBeenCalled();
  });
});
