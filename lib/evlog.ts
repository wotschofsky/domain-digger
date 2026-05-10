import { createEvlog } from 'evlog/next';
import { createInstrumentation } from 'evlog/next/instrumentation';

import { env } from '@/env';

export const { withEvlog, useLogger, log, createError } = createEvlog({
  service: env.EVLOG_SERVICE,
  env: { environment: env.NODE_ENV },
});

export const { register, onRequestError } = createInstrumentation({
  service: env.EVLOG_SERVICE,
  env: { environment: env.NODE_ENV },
});
