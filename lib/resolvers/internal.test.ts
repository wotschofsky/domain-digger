import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolverMultiResponse, ResolverResponse } from './base';
import { InternalDoHResolver } from './internal';

const fetchMock = vi.fn();
vi.mock('@/env', () => ({
  env: {
    SITE_URL: 'https://example.com',
    INTERNAL_API_SECRET: 'secret',
  },
}));

describe('InternalDoHResolver', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should successfully resolve DNS records', async () => {
    const resolver = new InternalDoHResolver('cdg', 'google');
    const summary: ResolverResponse = {
      records: [
        { name: 'example.com', type: 'A', TTL: 300, data: '192.168.1.1' },
      ],
      trace: ['DNS lookup'],
    };
    fetchMock.mockResolvedValue(Response.json({ A: summary }));

    const result = await resolver.resolveRecordType('example.com', 'A');
    expect(result).toEqual(summary);
    expect(fetch).toHaveBeenCalledWith(
      new URL(
        'https://example.com/api/internal/resolve/cdg?resolver=google&type=A&domain=example.com',
      ),
      {
        cache: 'no-store',
        headers: {
          Authorization: 'secret',
        },
      },
    );
  });

  it('should throw an error on failed DNS resolution', async () => {
    const resolver = new InternalDoHResolver('lhr', 'alibaba');
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toThrow(/DNS resolver \(lhr\)/);
  });

  it('should handle multiple DNS record types', async () => {
    const resolver = new InternalDoHResolver('hkg', 'cloudflare');
    const mockRecords: ResolverMultiResponse = {
      A: {
        records: [
          { name: 'example.com', type: 'A', TTL: 300, data: '192.168.1.1' },
        ],
        trace: ['IPv4 lookup'],
      },
      AAAA: {
        records: [{ name: 'example.com', type: 'AAAA', TTL: 300, data: '::1' }],
        trace: ['IPv6 lookup'],
      },
    };
    fetchMock.mockResolvedValue(Response.json(mockRecords));

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
        cache: 'no-store',
        headers: {
          Authorization: 'secret',
        },
      },
    );
  });
});
