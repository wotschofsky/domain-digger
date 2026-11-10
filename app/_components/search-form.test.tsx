import { act, Activity } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { type Cache, SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchForm } from './search-form';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const reportEvent = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/',
  useParams: () => ({}),
  useSelectedLayoutSegment: () => null,
}));
vi.mock('@/app/api/search-suggestions/hook', () => ({
  useSearchSuggestions: () => [],
}));
vi.mock('@/lib/analytics', () => ({
  useAnalytics: () => ({ reportEvent }),
}));
vi.mock('./my-ip-modal', () => ({
  MyIpModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" /> : null,
}));
vi.mock('./ip-details-modal', () => ({
  IpDetailsModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" /> : null,
}));

describe('search form', () => {
  let container: HTMLDivElement;
  let root: Root;
  let cache: Cache;
  const fetcher = vi.fn();
  const fetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    router.push.mockReset();
    reportEvent.mockReset();
    fetcher.mockReset();
    fetch.mockReset().mockRejectedValue(new TypeError('Network unavailable'));
    vi.stubGlobal('fetch', fetch);
    cache = new Map();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async (mode: 'visible' | 'hidden') => {
    await act(async () =>
      root.render(
        <SWRConfig value={{ provider: () => cache, fetcher }}>
          <Activity mode={mode}>
            <SearchForm autofocus={false} />
          </Activity>
        </SWRConfig>,
      ),
    );
  };

  it.each([
    [undefined, undefined],
    ['192.0.2.1', undefined],
    [undefined, '2001:db8::1'],
    ['192.0.2.1', '2001:db8::1'],
  ])(
    'always offers My IP and anonymizes cached addresses (%s, %s)',
    async (ipv4, ipv6) => {
      if (ipv4) cache.set('https://ipv4.icanhazip.com/', { data: ipv4 });
      if (ipv6) cache.set('https://ipv6.icanhazip.com/', { data: ipv6 });
      await render('visible');
      expect(fetcher).not.toHaveBeenCalled();
      const input = container.querySelector<HTMLInputElement>('input')!;
      await act(async () => input.focus());
      const row = Array.from(container.querySelectorAll('li')).find((item) =>
        item.textContent?.includes('Your IP addresses'),
      )!;
      expect(row).toBeDefined();
      const addresses = [
        ipv4 ? '192.xxx.xxx.xxx' : null,
        ipv6 ? '2001:xxxx:xxxx:xxxx:…' : null,
      ].filter(Boolean);
      expect(row.textContent).toBe(
        `Your IP addresses${addresses.length ? ` (${addresses.join(', ')})` : ''}`,
      );
      await act(async () => {
        window.dispatchEvent(new Event('online'));
        window.dispatchEvent(new Event('focus'));
      });
      expect(fetcher).not.toHaveBeenCalled();
      expect(
        reportEvent.mock.calls.filter(([event]) => event === 'My IP: Open'),
      ).toHaveLength(0);
    },
  );

  it('anonymizes cached alternative-provider results without revealing the full IP on hover', async () => {
    const ipv6 = '2001:0db8:1234:5678:90ab:cdef:1234:5678';
    cache.set('https://6.ident.me/', { data: ipv6 });
    await render('visible');
    await act(async () =>
      container.querySelector<HTMLInputElement>('input')!.focus(),
    );
    expect(container.textContent).toContain(
      'Your IP addresses (2001:xxxx:xxxx:xxxx:…)',
    );
    expect(container.querySelector(`[title="${ipv6}"]`)).toBeNull();
    expect(container.textContent).not.toContain(ipv6);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('detects and previews both addresses before opening the dialog for the first time', async () => {
    let finishIpv6!: (response: Response) => void;
    const ipv6 = new Promise<Response>((resolve) => {
      finishIpv6 = resolve;
    });
    fetch.mockImplementation((url: string) =>
      url.includes('ipv4.')
        ? Promise.resolve(new Response('203.0.113.42'))
        : ipv6,
    );
    await render('visible');
    expect(fetch).not.toHaveBeenCalled();
    const input = container.querySelector<HTMLInputElement>('input')!;
    await act(async () => input.focus());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain(
      'Your IP addresses (203.xxx.xxx.xxx)',
    );
    expect(container.textContent).not.toContain('203.0.113.42');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => finishIpv6(new Response('2001:db8:abcd::1234')));
    expect(container.textContent).toContain(
      'Your IP addresses (203.xxx.xxx.xxx, 2001:xxxx:xxxx:xxxx:…)',
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => {
      input.blur();
      input.focus();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not detect addresses when searching for a domain', async () => {
    await render('visible');
    const input = container.querySelector<HTMLInputElement>('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, 'example.com');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => input.focus());
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['mouse', 'keyboard'])(
    'tracks opening My IP via %s without sending the IP address',
    async (activation) => {
      await render('visible');
      const input = container.querySelector<HTMLInputElement>('input')!;
      await act(async () => input.focus());

      expect(
        reportEvent.mock.calls.filter(([event]) => event === 'My IP: Open'),
      ).toHaveLength(0);

      if (activation === 'mouse') {
        const suggestion = Array.from(container.querySelectorAll('li')).find(
          (item) => item.textContent?.includes('Your IP address'),
        )!;
        await act(async () => suggestion.click());
      } else {
        for (const key of ['ArrowDown', 'Enter']) {
          await act(async () => {
            input.dispatchEvent(
              new KeyboardEvent('keydown', {
                key,
                bubbles: true,
                cancelable: true,
              }),
            );
          });
        }
      }

      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
      expect(
        reportEvent.mock.calls.filter(([event]) => event === 'My IP: Open'),
      ).toEqual([['My IP: Open', {}]]);
      expect(router.push).not.toHaveBeenCalled();
    },
  );

  // Navigating away hides the page with Activity instead of unmounting it, so
  // pressing Back shows the same form instance again rather than a fresh one
  it('can search again after navigating back to it', async () => {
    await render('visible');
    const input = container.querySelector<HTMLInputElement>('input')!;

    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, 'example.com');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => input.form!.requestSubmit());

    expect(router.push).toHaveBeenCalledWith('/lookup/example.com');
    expect(input.disabled).toBe(true);

    await render('hidden');
    await render('visible');

    expect(input.disabled).toBe(false);
  });
});
