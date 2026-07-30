import { NextResponse } from 'next/server';

import { log, withEvlog } from '@/lib/evlog';

// Receives client-side logs from evlog's browser transport (see EvlogProvider
// in app/providers.tsx) and forwards them into the server logging pipeline
const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

const isLevel = (value: unknown): value is Level =>
  LEVELS.includes(value as Level);

export const POST = withEvlog(async (request: Request) => {
  // Public endpoint; only accept logs sent from our own pages
  const origin =
    request.headers.get('origin') ?? request.headers.get('referer');
  const host = request.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { level, ...event } = body as Record<string, unknown>;
  if (!isLevel(level)) {
    return NextResponse.json({ error: 'Invalid level' }, { status: 400 });
  }

  // The server logger sets its own service field
  delete event.service;
  log[level]({ ...event, source: 'client' });

  return new NextResponse(null, { status: 204 });
});
