import { createEvlog } from 'evlog/next';
import { createInstrumentation } from 'evlog/next/instrumentation/create';
import type { Instrumentation } from 'next';

import { env } from '@/env';
import { parseUserFacingDigest } from '@/lib/user-facing-error';

export const { withEvlog, useLogger, log, createError } = createEvlog({
  service: 'domain-digger',
  env: { environment: env.NODE_ENV },
});

export const { register } = createInstrumentation({
  service: 'domain-digger',
  env: { environment: env.NODE_ENV },
});

// The adapter's hook logs message and stack only; the original error keeps nested causes,
// and the digest ties it to browser reports.
export const onRequestError = (
  error: unknown,
  request: Parameters<Instrumentation.onRequestError>[1],
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
    renderSource?: string;
    revalidateReason?: string;
  },
) => {
  const digest =
    error !== null &&
    typeof error === 'object' &&
    'digest' in error &&
    typeof error.digest === 'string'
      ? error.digest
      : undefined;

  const expected = parseUserFacingDigest(digest) !== null;

  log[expected ? 'warn' : 'error']({
    message: 'server_request_failed',
    error: error instanceof Error ? error : new Error(String(error)),
    digest,
    path: request.path.split('?')[0],
    method: request.method,
    requestId:
      request.headers['x-vercel-id'] ?? request.headers['x-request-id'],
    ...context,
  });
};
