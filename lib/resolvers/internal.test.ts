import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { InternalDoHResolver } from './internal';

global.fetch = vi.fn();

describe('InternalDoHResolver', () => {
  beforeAll(() => {
    vi.mock('@/env', () => ({
      env: {
        SITE_URL: 'https://example.com',
        INTERNAL_API_SECRET: 'secret',
      },
    }));
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it('should successfully resolve DNS records', async () => {
    const resolver = new InternalDoHResolver('cdg', 'google');
    const mockRawRecord = [{ data: '192.168.1.1' }];
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ A: mockRawRecord }),
      status: 200,
      statusText: 'OK',
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const records = await resolver.resolveRecordType('example.com', 'A');
    expect(records).toEqual(mockRawRecord);
    expect(fetch).toHaveBeenCalledWith(
      new URL(
        'https://example.com/api/internal/resolve/cdg?resolver=google&type=A&domain=example.com',
      ),
      {
        headers: {
          Authorization: 'secret',
        },
      },
    );
  });

  it('should throw an error on failed DNS resolution', async () => {
    const resolver = new InternalDoHResolver('lhr', 'alibaba');
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toThrow(
      'Failed to fetch results for lhr from https://example.com/api/internal/resolve/lhr?resolver=alibaba&type=A&domain=example.com: 500 Internal Server Error',
    );
  });

  it('should handle multiple DNS record types', async () => {
    const resolver = new InternalDoHResolver('hkg', 'cloudflare');
    const mockRecords = {
      A: [{ data: '192.168.1.1' }],
      AAAA: [{ data: '::1' }],
    };
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve(mockRecords),
      status: 200,
      statusText: 'OK',
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const records = await resolver.resolveRecordTypes('example.com', [
      'A',
      'AAAA',
    ]);
    expect(records).toEqual(mockRecords);
    expect(fetch).toHaveBeenCalledWith(
      new URL(
        'https://example.com/api/internal/resolve/hkg?resolver=cloudflare&type=A&type=AAAA&domain=example.com',
      ),
      {
        headers: {
          Authorization: 'secret',
        },
      },
    );
  });
});
