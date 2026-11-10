import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IpDetailsContent } from './ip-details-modal';

describe('IP details after extraction into reusable content', () => {
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
              {open && <IpDetailsContent ip="192.0.2.1" />}
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
