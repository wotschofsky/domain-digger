import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IpDetails } from './ip-details';

vi.mock('next/dynamic', () => ({
  default:
    () =>
    ({ location }: { location: [number, number] }) => (
      <div role="img" aria-label={`Map at ${location.join(', ')}`} />
    ),
}));
vi.mock('@/lib/analytics', () => ({
  useAnalytics: () => ({ reportEvent: vi.fn() }),
}));

describe('shared IP details', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('renders the same address, sorted reverse records, and location details, including zero coordinates', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        reverse: ['server10.example', 'server2.example'],
        org: 'Example organization',
        isp: 'Example ISP',
        country: 'Example country',
        region: '',
        city: 'Example city',
        lat: 0,
        lon: 0,
        timezone: 'UTC',
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await act(async () =>
      root.render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <IpDetails ip="2001:db8::1" />
        </SWRConfig>,
      ),
    );
    expect(fetch).toHaveBeenCalledWith('/api/ip-details?ip=2001%3Adb8%3A%3A1');
    expect(container.textContent).toContain('2001:db8::1');
    expect(
      container.querySelectorAll('button[aria-label="Copy value"]'),
    ).toHaveLength(1);
    expect(
      Array.from(container.querySelectorAll('a[href^="/lookup/"]')).map(
        (link) => link.textContent,
      ),
    ).toEqual(['server2.example', 'server10.example']);
    for (const value of [
      'Example organization',
      'Example ISP',
      'Example country, Example city',
      'Latitude: 0; Longitude: 0',
      'UTC',
    ]) {
      expect(container.textContent).toContain(value);
    }
    expect(
      container.querySelector('[role="img"]')?.getAttribute('aria-label'),
    ).toBe('Map at 0, 0');
  });

  it('handles missing reverse and location details without leaving an empty map', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ reverse: [] })),
    );
    await act(async () =>
      root.render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <IpDetails ip="192.0.2.1" />
        </SWRConfig>,
      ),
    );
    expect(container.textContent).toContain('not configured');
    expect(container.textContent).toContain('unknown');
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it.each([200, 422])(
    'preserves structured errors, avoids automatic retry, and retries when reopened (HTTP %s)',
    async (status) => {
      const payload = {
        title: 'IP lookup failed',
        description: 'The provider could not find this address.',
        retryable: false,
      };
      const fetch = vi.fn(
        async () => new Response(JSON.stringify(payload), { status }),
      );
      vi.stubGlobal('fetch', fetch);
      const onErrorRetry = vi.fn();
      const cache = new Map();
      const render = async (open: boolean) => {
        await act(async () =>
          root.render(
            <SWRConfig value={{ provider: () => cache, onErrorRetry }}>
              {open && <IpDetails ip="192.0.2.1" />}
            </SWRConfig>,
          ),
        );
      };
      await render(false);
      expect(fetch).not.toHaveBeenCalled();
      await render(true);
      expect(container.textContent).toContain(payload.title);
      expect(container.textContent).toContain(payload.description);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(onErrorRetry).not.toHaveBeenCalled();
      await render(false);
      await render(true);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain(payload.title);
      expect(onErrorRetry).not.toHaveBeenCalled();
    },
  );
});
