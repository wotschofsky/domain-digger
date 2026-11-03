import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BoundaryError } from './boundary-error';

const { report } = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock('evlog/next/client', () => ({ log: { error: report } }));

describe('browser boundary error correlation', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_COMMIT', 'browser-commit');
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_ID', 'browser-deployment');
    window.history.replaceState({}, '', '/lookup/example.com/dnssec?q=private');
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it.each([
    [
      'Minified React error #412; visit the decoder',
      'connection_closed',
      '412',
    ],
    ['Minified React error #441; visit the decoder', 'server_render', '441'],
    ['Unexpected application failure', 'application', undefined],
  ])(
    'reports route and browser build context for %s',
    async (message, category, reactErrorCode) => {
      const container = document.createElement('div');
      const root = createRoot(container);
      const error = Object.assign(new Error(message), {
        digest: 'server-digest',
      });
      try {
        await act(async () =>
          root.render(<BoundaryError error={error} retry={() => {}} />),
        );
        expect(report).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'boundary_error',
            page: '/lookup/example.com/dnssec',
            browserCommit: 'browser-commit',
            browserDeploymentId: 'browser-deployment',
            digest: 'server-digest',
            category,
            reactErrorCode,
          }),
        );
        expect(JSON.stringify(report.mock.calls[0][0])).not.toContain(
          'q=private',
        );
      } finally {
        await act(async () => root.unmount());
      }
    },
  );
});
