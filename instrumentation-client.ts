import { initBotId } from 'botid/client/core';

initBotId({ protect: [{ path: '/api/is-human', method: 'POST' }] });

// Analytics only load once that check passes (app/providers.tsx). Until then,
// queue Plausible events: its script replays them once loaded, and for bots it
// never loads, so theirs are dropped.
const queue: unknown[][] = [];
(window as { plausible?: unknown }).plausible ??= Object.assign(
  (...args: unknown[]) => queue.push(args),
  { q: queue },
);
