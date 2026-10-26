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
vi.mock('./ip-details-modal', () => ({ IpDetailsModal: () => null }));

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
