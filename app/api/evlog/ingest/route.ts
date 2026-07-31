import { z } from 'zod';

import { useLogger, withEvlog } from '@/lib/evlog';

const clientLogSchema = z
  .object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    timestamp: z.string(),
    service: z.string(),
  })
  .passthrough();

const MAX_BODY_SIZE_BYTES = 100 * 1024;

export const POST = withEvlog(async (request: Request) => {
  const logger = useLogger();

  const source =
    request.headers.get('origin') ?? request.headers.get('referer');
  const expectedHost = new URL(request.url).host;
  if (
    source === null ||
    !URL.canParse(source) ||
    new URL(source).host !== expectedHost
  ) {
    return new Response(null, { status: 403 });
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (contentLength > MAX_BODY_SIZE_BYTES) {
    return new Response(null, { status: 413 });
  }

  const raw = await request.text().catch(() => undefined);
  if (
    raw !== undefined &&
    Buffer.byteLength(raw, 'utf8') > MAX_BODY_SIZE_BYTES
  ) {
    return new Response(null, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = raw === undefined ? undefined : JSON.parse(raw);
  } catch {
    payload = undefined;
  }
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
