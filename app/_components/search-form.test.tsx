import { act, Activity } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
vi.mock('swr/immutable', () => ({ default: () => ({ data: undefined }) }));
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

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    router.push.mockReset();
    reportEvent.mockReset();
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
        <Activity mode={mode}>
          <SearchForm autofocus={false} />
        </Activity>,
      ),
    );
  };

  it.each(['mouse', 'keyboard'])(
    'tracks opening My IP via %s without sending the IP address',
    async (activation) => {
      await render('visible');
      const input = container.querySelector<HTMLInputElement>('input')!;
      await act(async () => input.focus());

      expect(reportEvent).not.toHaveBeenCalled();

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
      expect(reportEvent.mock.calls).toEqual([['My IP: Open', {}]]);
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
