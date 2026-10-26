import { PathParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { act, Activity, Component, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LookupHeader } from './lookup-header';

vi.mock('./domain-summary', () => ({ DomainSummary: () => null }));
vi.mock('./related-domains', () => ({ RelatedDomains: () => null }));
vi.mock('./results-tabs', () => ({ ResultsTabs: () => null }));
vi.mock('./share-button', () => ({ ShareButton: () => null }));

const errors: unknown[] = [];

// Stands in for app/error.tsx, which sits inside the hidden page
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError = (error: unknown) => {
    errors.push(error);
    return { failed: true };
  };
  render = () => (this.state.failed ? null : this.props.children);
}

describe('lookup header', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    errors.length = 0;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  // Like layout-router: navigating to a landing page hides the lookup page
  // with Activity instead of unmounting it, while useParams switches to the
  // landing URL's params
  const render = async (params: { domain?: string }) => {
    const onLookup = 'domain' in params;
    await act(async () =>
      root.render(
        <PathParamsContext.Provider value={params}>
          <Activity mode={onLookup ? 'visible' : 'hidden'}>
            <ErrorBoundary>
              <LookupHeader />
            </ErrorBoundary>
          </Activity>
          <Activity mode={onLookup ? 'hidden' : 'visible'}>
            <p>landing</p>
          </Activity>
        </PathParamsContext.Provider>,
      ),
    );
  };

  it('renders nothing while hidden on a page without a domain', async () => {
    await render({ domain: 'example.com' });
    expect(container.querySelector('h1')?.textContent).toContain('example.com');

    await render({});

    expect(errors).toEqual([]);
    expect(container.querySelector('h1')).toBeNull();
  });
});
