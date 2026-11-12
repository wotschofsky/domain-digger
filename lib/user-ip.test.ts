import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchUserIp } from './user-ip';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('public IP detection', () => {
  it.each([
    [4, '192.0.2.1'],
    [6, '2001:db8::1'],
  ] as const)(
    'requests IPv%s directly and reads plain text',
    async (version, ip) => {
      const fetch = vi.fn().mockResolvedValue(new Response(` ${ip}\n`));
      vi.stubGlobal('fetch', fetch);

      await expect(fetchUserIp(version)).resolves.toBe(ip);
      expect(fetch).toHaveBeenCalledWith(
        `https://ipv${version}.icanhazip.com/`,
        {
          signal: expect.any(AbortSignal),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          cache: 'no-store',
        },
      );
    },
  );

  it.each(['2001:db8::1', '<html>error</html>'])(
    'rejects a wrong-family or invalid IPv4 response',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
      await expect(fetchUserIp(4)).rejects.toThrow('Invalid IP response');
    },
  );

  it('uses ident.me only when explicitly requested', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('2001:db8::1'));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchUserIp(6, 'ident.me')).resolves.toBe('2001:db8::1');
    expect(fetch.mock.calls[0][0]).toBe('https://6.ident.me/');
  });

  it('rejects HTTP failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 503 })),
    );
    await expect(fetchUserIp(6)).rejects.toThrow('IP detection failed');
  });

  it('aborts a stalled request after three seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, { signal }: RequestInit) =>
          new Promise((_resolve, reject) => {
            signal!.addEventListener('abort', () => reject(signal!.reason));
          }),
      ),
    );
    const result = expect(fetchUserIp(6)).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    await vi.advanceTimersByTimeAsync(3000);
    await result;
  });
});
