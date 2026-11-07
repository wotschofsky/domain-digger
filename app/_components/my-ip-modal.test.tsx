import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { type Cache, SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MyIpModal } from './my-ip-modal';

const reportEvent = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics', () => ({ useAnalytics: () => ({ reportEvent }) }));
vi.mock('./ip-details-modal', () => ({
  IpDetailsContent: ({ ip }: { ip: string }) => <div>Details for {ip}</div>,
}));

describe('My IP addresses', () => {
  let container: HTMLDivElement;
  let root: Root;
  let cache: Cache;
  let fetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    reportEvent.mockReset();
    fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    cache = new Map();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async (open: boolean) => {
    await act(async () => {
      root.render(
        <SWRConfig value={{ provider: () => cache }}>
          <MyIpModal open={open} onOpenChange={() => {}} />
        </SWRConfig>,
      );
    });
  };

  it('waits for opening, displays both families, and reuses cached results', async () => {
    fetch.mockImplementation(
      async (url: string) =>
        new Response(
          url.includes('ipv4.') || url.includes('4.ident')
            ? '192.0.2.1'
            : '2001:db8::1',
        ),
    );
    await render(false);
    expect(fetch).not.toHaveBeenCalled();
    await render(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('192.0.2.1');
    expect(document.body.textContent).toContain('2001:db8::1');
    await render(false);
    await render(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps IPv4 usable while IPv6 fails and allows an explicit retry', async () => {
    fetch.mockImplementation(async (url: string) => {
      if (url.includes('ipv6.') || url.includes('6.ident'))
        throw new TypeError('Failed to fetch');
      return new Response('192.0.2.1');
    });
    await render(true);
    expect(document.body.textContent).toContain('192.0.2.1');
    expect(document.body.textContent).toContain('Not detected');
    expect(reportEvent).toHaveBeenCalledWith('My IP: Detection', {
      version: 6,
      provider: 'icanhazip',
      result: 'error',
    });

    fetch.mockResolvedValue(new Response('2001:db8::2'));
    const retry = document.querySelector<HTMLButtonElement>(
      '[aria-label="Retry IPv6"]',
    )!;
    await act(async () => retry.click());
    expect(document.body.textContent).toContain('2001:db8::2');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([4, 6])(
    'automatically shows IPv%s details and keeps that selection when the other address arrives',
    async (firstVersion) => {
      let resolveLater!: (response: Response) => void;
      const later = new Promise<Response>((resolve) => {
        resolveLater = resolve;
      });
      const firstIp = firstVersion === 4 ? '192.0.2.1' : '2001:db8::1';
      const laterIp = firstVersion === 4 ? '2001:db8::1' : '192.0.2.1';
      fetch.mockImplementation((url: string) =>
        url.includes(`ipv${firstVersion}.`)
          ? Promise.resolve(new Response(firstIp))
          : later,
      );
      await render(true);
      expect(document.body.textContent).toContain(`Details for ${firstIp}`);
      await act(async () => resolveLater(new Response(laterIp)));
      expect(document.body.textContent).toContain(`Details for ${firstIp}`);
      expect(document.body.textContent).not.toContain(`Details for ${laterIp}`);
      const other = document.querySelector<HTMLButtonElement>(
        `[role="tab"][aria-label^="IPv${firstVersion === 4 ? 6 : 4}"]`,
      )!;
      await act(async () => {
        other.dispatchEvent(
          new MouseEvent('mousedown', {
            bubbles: true,
            button: 0,
            ctrlKey: false,
          }),
        );
        other.click();
      });
      expect(document.body.textContent).toContain(`Details for ${laterIp}`);
      expect(other.getAttribute('aria-selected')).toBe('true');
    },
  );

  it('switches details using the keyboard tabs', async () => {
    fetch.mockImplementation(
      async (url: string) =>
        new Response(url.includes('ipv4.') ? '192.0.2.1' : '2001:db8::1'),
    );
    await render(true);
    const tabs = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    await act(async () => tabs[0].focus());
    await act(async () => {
      tabs[0].dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(document.body.textContent).toContain('Details for 2001:db8::1');
    expect(document.querySelectorAll('[role="tablist"]')).toHaveLength(1);
  });

  it('contacts ident.me only after an explicit alternative-provider retry', async () => {
    fetch.mockImplementation(async (url: string) => {
      if (url.includes('ipv6.')) throw new TypeError('Failed to fetch');
      return new Response(url.includes('ipv4.') ? '192.0.2.1' : '2001:db8::1');
    });
    await render(true);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(
      expect.arrayContaining([
        'https://ipv4.icanhazip.com/',
        'https://ipv6.icanhazip.com/',
      ]),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    const alternative = document.querySelector<HTMLButtonElement>(
      '[aria-label="Use ident.me for IPv6"]',
    )!;
    await act(async () => alternative.click());
    expect(fetch.mock.calls[2][0]).toBe('https://6.ident.me/');
    expect(document.body.textContent).toContain('2001:db8::1');
  });

  it('shows IPv4 while the IPv6 request is still pending', async () => {
    let resolveV6!: (response: Response) => void;
    const ipv6 = new Promise<Response>((resolve) => {
      resolveV6 = resolve;
    });
    fetch.mockImplementation((url: string) =>
      url.includes('ipv4.') || url.includes('4.ident')
        ? Promise.resolve(new Response('192.0.2.1'))
        : ipv6,
    );
    await render(true);
    expect(document.body.textContent).toContain('192.0.2.1');
    expect(
      document.querySelector<HTMLButtonElement>(
        '[role="tab"][aria-label^="IPv6"]',
      )?.disabled,
    ).toBe(true);
    await act(async () => resolveV6(new Response('2001:db8::1')));
    expect(document.body.textContent).toContain('2001:db8::1');
  });
});
