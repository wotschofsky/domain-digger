import { initBotId } from 'botid/client/core';

initBotId({ protect: [{ path: '/api/is-human', method: 'POST' }] });

// Queue Plausible events reported before its script loads (such as the BotID
// check in app/providers.tsx); the script replays them once loaded.
const queue: unknown[][] = [];
(window as { plausible?: unknown }).plausible ??= Object.assign(
  (...args: unknown[]) => queue.push(args),
  { q: queue },
);
