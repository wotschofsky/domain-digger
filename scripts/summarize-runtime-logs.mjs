import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const summarizeRuntimeLogs = (rows) => {
  const seen = new Set();
  /** @type {Record<string, number>} */
  const requestsWithEvent = Object.create(null);
  /** @type {Record<string, number>} */
  const platformTimeoutsByFeature = Object.create(null);
  /** @type {Record<string, number[]>} */
  const durations = Object.create(null);
  let from;
  let until;
  for (const row of rows) {
    if (!row.id) throw new Error('Expected Vercel request logs with an id');
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (typeof row.timestamp === 'number') {
      from = Math.min(from ?? row.timestamp, row.timestamp);
      until = Math.max(until ?? row.timestamp, row.timestamp);
    }
    const messages = [
      row.message,
      ...(row.logs ?? []).map((entry) => entry.message),
    ].filter((message) => typeof message === 'string');
    if (
      messages.some((message) =>
        message.startsWith('Vercel Runtime Timeout Error:'),
      )
    ) {
      const segment = row.requestPath?.split('/').at(-1);
      const feature = ['subdomains', 'certs', 'dnssec'].includes(segment)
        ? segment
        : 'other';
      platformTimeoutsByFeature[feature] =
        (platformTimeoutsByFeature[feature] ?? 0) + 1;
    }
    const eventKeys = new Set();
    const names = new Set();
    for (const message of messages) {
      let event;
      try {
        event = JSON.parse(message);
      } catch {
        continue;
      }
      if (!event || typeof event !== 'object') continue;
      const name = event.message ?? event.event;
      if (typeof name === 'string') names.add(name);
      // A request's top-level message may repeat an entry from logs[].
      const key = JSON.stringify(event);
      if (eventKeys.has(key)) continue;
      eventKeys.add(key);
      if (
        typeof event.operation === 'string' &&
        typeof event.durationMs === 'number'
      ) {
        (durations[event.operation] ??= []).push(event.durationMs);
      }
    }
    for (const name of names)
      requestsWithEvent[name] = (requestsWithEvent[name] ?? 0) + 1;
  }
  return {
    uniqueRequests: seen.size,
    observedFrom: from === undefined ? null : new Date(from).toISOString(),
    observedUntil: until === undefined ? null : new Date(until).toISOString(),
    requestsWithEvent,
    platformTimeoutsByFeature,
    stageDurations: Object.fromEntries(
      Object.entries(durations).map(([operation, values]) => {
        values.sort((a, b) => a - b);
        return [
          operation,
          {
            samples: values.length,
            p50Ms: values[Math.ceil(values.length * 0.5) - 1],
            p95Ms: values[Math.ceil(values.length * 0.95) - 1],
          },
        ];
      }),
    ),
    coverage:
      'Counts only: confirm export completeness before deriving rates. Client reports are separate requests, not additional server failures.',
  };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const rows = readFileSync(0, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  process.stdout.write(
    JSON.stringify(summarizeRuntimeLogs(rows), null, 2) + '\n',
  );
}
