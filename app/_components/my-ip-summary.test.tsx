import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IpLookupResponse } from '@/app/api/ip-details/route';

import { MyIpSummary } from './my-ip-summary';

vi.mock('./ip-details-modal', () => ({
  LocationMap: () => <div data-testid="location-map" />,
}));

const base: IpLookupResponse = {
  isp: 'Example ISP',
  org: 'Example Network',
  city: 'Berlin',
  country: 'Germany',
  region: 'Berlin',
  timezone: 'Europe/Berlin',
  lat: 52.5,
  lon: 13.4,
  reverse: ['host.example.com'],
};

describe('combined IP summary', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetcher: ReturnType<
    typeof vi.fn<(url: string) => Promise<IpLookupResponse>>
  >;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    fetcher = vi.fn().mockResolvedValue(base);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  const render = async (ipv6: string | null = '2001:db8::1') => {
    const cache = new Map();
    await act(async () =>
      root.render(
        <SWRConfig
          value={{ provider: () => cache, fetcher, shouldRetryOnError: false }}
        >
          <MyIpSummary ipv4="192.0.2.1" ipv6={ipv6 ?? undefined} />
        </SWRConfig>,
      ),
    );
  };
  const row = (label: string) =>
    Array.from(container.querySelectorAll('tbody tr')).find(
      (item) => item.querySelector('th')?.textContent === label,
    )!;

  it('renders matching fields and location once', async () => {
    await render();
    expect(row('ISP').querySelectorAll('td')).toHaveLength(1);
    expect(row('ISP').querySelector('td')?.colSpan).toBe(2);
    expect(row('Reverse DNS').querySelector('a')?.getAttribute('href')).toBe(
      '/lookup/host.example.com',
    );
    expect(
      container.querySelectorAll('[data-testid="location-map"]'),
    ).toHaveLength(1);
    expect(container.textContent).toContain(
      'Approximate location · IPv4 and IPv6',
    );
  });

  it('keeps different networks and locations separate', async () => {
    fetcher.mockImplementation(async (url: string) =>
      url.includes('192.0.2.1')
        ? base
        : {
            ...base,
            isp: 'Other ISP',
            city: 'Paris',
            country: 'France',
            lat: 48.8,
            lon: 2.3,
          },
    );
    await render();
    expect(row('ISP').querySelectorAll('td')).toHaveLength(2);
    expect(row('ISP').textContent).toContain('Other ISP');
    expect(row('Location').textContent).toContain('Berlin');
    expect(row('Location').textContent).toContain('Paris');
    expect(
      container.querySelectorAll('[data-testid="location-map"]'),
    ).toHaveLength(2);
  });

  it('does not merge pending data and merges matching data when it arrives', async () => {
    let finish!: (value: IpLookupResponse) => void;
    const pending = new Promise<IpLookupResponse>((resolve) => {
      finish = resolve;
    });
    fetcher.mockImplementation((url: string) =>
      url.includes('192.0.2.1') ? Promise.resolve(base) : pending,
    );
    await render();
    expect(row('ISP').querySelectorAll('td')).toHaveLength(2);
    expect(row('ISP').textContent).toContain('Loading IPv6 ISP');
    await act(async () => finish(base));
    expect(row('ISP').querySelector('td')?.colSpan).toBe(2);
  });

  it('keeps successful data visible when the other details request fails', async () => {
    fetcher.mockImplementation(async (url: string) => {
      if (!url.includes('192.0.2.1')) throw new Error('Details unavailable');
      return base;
    });
    await render();
    expect(row('ISP').querySelectorAll('td')).toHaveLength(2);
    expect(row('ISP').textContent).toContain('Example ISP');
    expect(row('ISP').textContent).toContain('Unavailable');
    expect(
      container.querySelector('[aria-label="Retry IPv6 details"]'),
    ).not.toBeNull();
    fetcher.mockResolvedValue(base);
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Retry IPv6 details"]')!
        .click(),
    );
    expect(row('ISP').querySelector('td')?.colSpan).toBe(2);
  });

  it('works with just one detected address', async () => {
    await render(null);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(row('ISP').querySelectorAll('td')).toHaveLength(1);
    expect(row('ISP').querySelector('td')?.colSpan).toBe(1);
    expect(container.textContent).not.toContain('IPv6');
  });
});
