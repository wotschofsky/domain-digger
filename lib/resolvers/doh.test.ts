import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AlibabaDoHResolver } from './alibaba';
import { CloudflareDoHResolver } from './cloudflare';
import { GoogleDoHResolver } from './google';

describe.each([
  {
    name: 'Cloudflare',
    Resolver: CloudflareDoHResolver,
    endpoint: 'https://cloudflare-dns.com/dns-query',
    accept: 'application/dns-json',
  },
  {
    name: 'Google',
    Resolver: GoogleDoHResolver,
    endpoint: 'https://dns.google/resolve',
    accept: 'application/json',
  },
  {
    name: 'Alibaba',
    Resolver: AlibabaDoHResolver,
    endpoint: 'https://dns.alidns.com/resolve',
    accept: 'application/json',
  },
])('$name DoH resolver', ({ Resolver, endpoint, accept }) => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 0 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('uses the provider endpoint and disables caching by default', async () => {
    await new Resolver().resolveRecordType('example.com', 'A');
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(`${endpoint}?name=example.com&type=A`),
      {
        method: 'GET',
        headers: { Accept: accept },
        cache: 'no-store',
        signal: undefined,
      },
    );
  });

  it('passes the caller’s cancellation signal to the shared transport', async () => {
    const controller = new AbortController();
    const resolver = new Resolver({ signal: controller.signal });
    await resolver.resolveAnswers('_service.example.com', 'TXT');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      cache: 'no-store',
      signal: controller.signal,
    });
  });

  it('encodes DNS names as a single query parameter', async () => {
    await new Resolver().resolveAnswers(
      'example.com&name=other.example',
      'TXT',
    );
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.getAll('name')).toEqual([
      'example.com&name=other.example',
    ]);
    expect(url.searchParams.get('type')).toBe('TXT');
  });
});
