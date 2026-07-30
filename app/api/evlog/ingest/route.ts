import { NextResponse } from 'next/server';

import { log, useLogger, withEvlog } from '@/lib/evlog';

// Receives client-side logs from evlog's browser transport (see
// app/providers.tsx) and forwards them into the server logging pipeline
const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

const isLevel = (value: unknown): value is Level =>
  LEVELS.includes(value as Level);

const MAX_BODY_LENGTH = 32_768;

export const POST = withEvlog(async (request: Request) => {
  const requestLog = useLogger();

  // Public endpoint; only accept logs sent from our own pages. The origin
  // check stops browsers, not scripted clients that forge the header.
  // ponytail: no rate limiting — if log flooding ever becomes a problem, add
  // it at the edge (e.g. Vercel WAF) rather than in the handler
  const origin =
    request.headers.get('origin') ?? request.headers.get('referer');
  const host = request.headers.get('host');
  if (
    !origin ||
    !host ||
    !URL.canParse(origin) ||
    new URL(origin).host !== host
  ) {
    requestLog.set({ status: 403, reason: 'invalid_origin' });
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  // Check the declared size before buffering the body; clients that lie or
  // send chunked requests are caught by the length check after reading, with
  // the platform's request-size cap bounding the worst case in between
  const contentLength = Number(request.headers.get('content-length'));
  if (contentLength > MAX_BODY_LENGTH) {
    requestLog.set({ status: 413, reason: 'payload_too_large' });
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_LENGTH) {
    requestLog.set({ status: 413, reason: 'payload_too_large' });
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // Handled by the object check below
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    requestLog.set({ status: 400, reason: 'invalid_payload' });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { level, ...event } = body as Record<string, unknown>;
  if (!isLevel(level)) {
    requestLog.set({ status: 400, reason: 'invalid_level' });
    return NextResponse.json({ error: 'Invalid level' }, { status: 400 });
  }

  // Server-owned fields: the logger stamps its own environment context, and
  // `audit` triggers evlog's audit pipeline, which expects a shape a forged
  // request need not provide (unguarded audit.actor.type access throws)
  delete event.service;
  delete event.environment;
  delete event.version;
  delete event.commitHash;
  delete event.region;
  delete event.audit;

  // Normalize like evlog's reference ingest handler: drop malformed or
  // implausible timestamps so forged values cannot corrupt downstream drains
  const { timestamp } = event;
  const parsedTimestamp =
    typeof timestamp === 'string' || typeof timestamp === 'number'
      ? new Date(timestamp)
      : null;
  if (
    parsedTimestamp === null ||
    Number.isNaN(parsedTimestamp.getTime()) ||
    parsedTimestamp.getTime() < Date.parse('2000-01-01') ||
    parsedTimestamp.getTime() > Date.now() + 24 * 60 * 60 * 1000
  ) {
    delete event.timestamp;
  } else {
    event.timestamp = parsedTimestamp.toISOString();
  }

  try {
    log[level]({ ...event, source: 'client' });
  } catch {
    // Never let a hostile payload shape turn into a 500 from the logger
    requestLog.set({ status: 400, reason: 'unloggable_payload' });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
});
