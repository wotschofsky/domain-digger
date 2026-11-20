import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportBotIdVerdict } from './providers';

const respond = (body: string, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status })),
  );

describe('BotID trial', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['a human verdict', '{"isHuman":true}', 200, 'human'],
    ['a bot verdict', '{"isHuman":false}', 200, 'bot'],
    // A failed check must not inflate the bot share the trial measures
    ['a server error with a JSON body', '{"message":"failed"}', 500, 'error'],
    ['a non-JSON response', '<html>challenge</html>', 403, 'error'],
  ])('reports %s as %s', async (_, body, status, result) => {
    respond(body, status);
    const reportEvent = vi.fn();

    await reportBotIdVerdict(reportEvent);

    // Non-interactive, so the event doesn't turn bounces into engaged visits
    expect(reportEvent).toHaveBeenCalledWith(
      'BotID: Check',
      { result },
      { interactive: false },
    );
  });
});
