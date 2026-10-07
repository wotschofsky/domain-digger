import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CloudflareDoHResolver } from './cloudflare';

describe('CloudflareDoHResolver', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 0 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('uses the Cloudflare JSON endpoint without imposing caller-specific fetch options', async () => {
    await new CloudflareDoHResolver().resolveRecordType('example.com', 'A');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      'https://cloudflare-dns.com/dns-query?name=example.com&type=A',
    );
    expect(options).toEqual({
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
    });
  });

  it('passes through the caller’s cache policy and cancellation signal', async () => {
    const controller = new AbortController();
    const resolver = new CloudflareDoHResolver({
      cache: 'no-store',
      signal: controller.signal,
    });
    await resolver.resolveAnswers('_for-sale.example.com', 'TXT');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      cache: 'no-store',
      signal: controller.signal,
    });
  });

  it('encodes DNS names as a single query parameter', async () => {
    await new CloudflareDoHResolver().resolveAnswers(
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
