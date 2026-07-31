import { z } from 'zod';

import { useLogger, withEvlog } from '@/lib/evlog';

const clientLogSchema = z
  .object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    timestamp: z.string(),
    service: z.string(),
  })
  .passthrough();

export const POST = withEvlog(async (request: Request) => {
  const logger = useLogger();
  const payload = await request.json().catch(() => undefined);
  const result = clientLogSchema.safeParse(payload);

  if (!result.success) {
    logger.warn('Rejected an invalid client log', {
      source: 'client',
      validationIssues: result.error.issues,
    });
    return new Response(null, { status: 400 });
  }

  const { level, ...clientLog } = result.data;
  logger.setLevel(level);
  logger.set({
    source: 'client',
    clientLog,
  });

  return new Response(null, { status: 204 });
});
