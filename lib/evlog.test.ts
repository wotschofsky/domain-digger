import type { Instrumentation } from 'next';
import { describe, expect, it, vi } from 'vitest';

import { log, onRequestError } from './evlog';

vi.mock('@/env', () => ({ env: { NODE_ENV: 'test' } }));

describe('server error correlation', () => {
  it('passes the original error, digest, route and request ID, without the query string', () => {
    const report = vi.spyOn(log, 'error').mockImplementation(() => {});

    const error = Object.assign(
      new Error('outer', { cause: new Error('inner') }),
      { digest: 'server-digest' },
    );

    const context = {
      routerKind: 'App Router',
      routePath: '/lookup/[domain]/certs',
      routeType: 'render',
      renderSource: 'react-server-components',
      revalidateReason: undefined,
    } satisfies Parameters<Instrumentation.onRequestError>[2];

    onRequestError(
      error,
      {
        path: '/lookup/example.com/certs?q=private',
        method: 'GET',
        headers: { 'x-vercel-id': 'request-1' },
      },
      context,
    );

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        digest: 'server-digest',
        path: '/lookup/example.com/certs',
        requestId: 'request-1',
        routePath: '/lookup/[domain]/certs',
      }),
    );

    report.mockRestore();
  });
});
