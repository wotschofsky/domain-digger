// @vitest-environment node
import { log } from 'evlog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INCOMPLETE_LOOKUP_ERROR } from '@/lib/resolvers/base-doh';
import { InternalDoHResolver } from '@/lib/resolvers/internal';
import { UserFacingError } from '@/lib/user-facing-error';

import { handler } from './base';

vi.mock('@/env', () => ({
  env: { SITE_URL: 'https://example.com', INTERNAL_API_SECRET: 'secret' },
}));

// The DoH answer for each record type, keyed by type name.
const upstream: Record<string, object> = {};

describe('internal resolve route', () => {
  beforeEach(() => {
    vi.spyOn(log, 'warn').mockImplementation(() => {});
    // Requests to the route reach its handler; the rest go to the DoH resolver.
    vi.stubGlobal('fetch', async (input: URL, init?: RequestInit) =>
      input.pathname.startsWith('/api/internal/resolve/')
        ? handler(new Request(input, { headers: init?.headers }))
        : Response.json(upstream[input.searchParams.get('type')!]),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('passes a failed type through with its error', async () => {
    upstream.A = {
      Status: 0,
      Answer: [{ name: 'example.com', type: 1, TTL: 300, data: '192.0.2.1' }],
    };
    upstream.AAAA = { Status: 2 };

    const results = await new InternalDoHResolver(
      'fra',
      'cloudflare',
    ).resolveRecordTypes('example.com', ['A', 'AAAA']);

    expect(results.A.records.map((record) => record.data)).toEqual([
      '192.0.2.1',
    ]);
    expect(results.AAAA).toEqual({
      records: [],
      trace: [],
      error: INCOMPLETE_LOOKUP_ERROR,
    });
  });

  it('answers a lookup where every type failed with its error, which the caller rethrows', async () => {
    upstream.A = { Status: 2 };
    upstream.AAAA = { Status: 2 };

    const response = await handler(
      new Request(
        'https://example.com/api/internal/resolve/fra?resolver=cloudflare&type=A&type=AAAA&domain=example.com',
        { headers: { Authorization: 'secret' } },
      ),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual(INCOMPLETE_LOOKUP_ERROR);

    const lookup = new InternalDoHResolver(
      'fra',
      'cloudflare',
    ).resolveRecordTypes('example.com', ['A', 'AAAA']);
    await expect(lookup).rejects.toBeInstanceOf(UserFacingError);
    await expect(lookup).rejects.toMatchObject({
      payload: INCOMPLETE_LOOKUP_ERROR,
    });
  });
});
