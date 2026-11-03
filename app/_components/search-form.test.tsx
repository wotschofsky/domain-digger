import { act, Activity } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchForm } from './search-form';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/',
  useParams: () => ({}),
  useSelectedLayoutSegment: () => null,
}));
vi.mock('swr/immutable', () => ({ default: () => ({ data: undefined }) }));
vi.mock('@/lib/analytics', () => ({
  useAnalytics: () => ({ reportEvent: vi.fn() }),
}));
vi.mock('./ip-details-modal', () => ({
  IpDetailsModal: ({ ip, open }: { ip: string; open: boolean }) =>
    open ? <div data-testid="ip-modal">{ip}</div> : null,
}));

describe('search form', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    router.push.mockReset();
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

  it.each(['user@8.8.8.8', 'https://8.8.8.8/path'])(
    'passes the parsed address to the IP dialog for %s',
    async (value) => {
      await render('visible');
      const input = container.querySelector<HTMLInputElement>('input')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => input.form!.requestSubmit());
      expect(
        container.querySelector('[data-testid="ip-modal"]')?.textContent,
      ).toBe('8.8.8.8');
      expect(router.push).not.toHaveBeenCalled();
    },
  );

  it('explains why local interface-scoped addresses are unsupported', async () => {
    await render('visible');
    const input = container.querySelector<HTMLInputElement>('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, 'fe80::1%lo0');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => input.form!.requestSubmit());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Interface-scoped',
    );
    expect(container.querySelector('[data-testid="ip-modal"]')).toBeNull();
  });

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
