import path from 'node:path';

import { log } from 'evlog';
import { execa } from 'execa';
import { z } from 'zod';

import { CloudflareDoHResolver } from './resolvers/cloudflare';
import { UserFacingError } from './user-facing-error';
import { isValidDomain } from './utils';

const DETAILED_RESULTS_LIMIT = 500;
const SUBFINDER_TIMEOUT_SECONDS = 8;
const DISCOVERY_DEADLINE_MS = 35_000;
const DETAILS_DEADLINE_MS = 5_000;
const DETAILS_CONCURRENCY = 10;

const SUBFINDER_BIN = path.join(process.cwd(), 'bin', 'subfinder');

// Some upstream sources (notably Subdomain Center) encode wildcard records
// like `*.foo.bar` as the literal string `wildcard.foo.bar` because `*` isn't
// a valid DNS label character. Convert back so the UI shows the asterisk.
const denormalizeWildcard = (host: string) =>
  host.startsWith('wildcard.') ? `*.${host.slice('wildcard.'.length)}` : host;

const subfinderRecordSchema = z.object({
  host: z.string().transform(denormalizeWildcard),
  sources: z.array(z.string()).optional().default([]),
});

type Discovery = z.infer<typeof subfinderRecordSchema>;

const readDiscovery = (line: string) => {
  if (!line) return null;

  try {
    const record = subfinderRecordSchema.safeParse(JSON.parse(line));
    return record.success ? record.data : null;
  } catch {
    return null;
  }
};

const runSubfinder = async (domain: string) => {
  try {
    const { stdout } = await execa(
      SUBFINDER_BIN,
      [
        '-d',
        domain,
        '-json',
        '-cs', // collect-sources: emit one record per host with all sources
        '-silent',
        '-timeout',
        String(SUBFINDER_TIMEOUT_SECONDS),
      ],
      {
        // Vercel's serverless filesystem is read-only except for /tmp; point
        // subfinder's config dir there so first-run bootstrap can write.
        env: { HOME: '/tmp' },
        timeout: DISCOVERY_DEADLINE_MS,
        killSignal: 'SIGKILL',
      },
    );

    return { discoveries: parseDiscoveries(stdout), incomplete: false };
  } catch (error) {
    if (
      error instanceof Error &&
      'timedOut' in error &&
      error.timedOut &&
      'stdout' in error &&
      typeof error.stdout === 'string'
    ) {
      return { discoveries: parseDiscoveries(error.stdout), incomplete: true };
    }
    throw new UserFacingError(
      {
        title: 'Subdomain discovery failed',
        description:
          'Our subdomain enumeration tool exited unexpectedly. Please try again shortly.',
        retryable: true,
      },
      { cause: error },
    );
  }
};

const parseDiscoveries = (stdout: string) =>
  stdout
    .split('\n')
    .map(readDiscovery)
    .filter((discovery): discovery is Discovery => discovery !== null);

type CreateResolver = (
  signal: AbortSignal,
) => Pick<CloudflareDoHResolver, 'resolveAnswers'>;

export const findSubdomains = async (
  domain: string,
  createResolver: CreateResolver = (signal) =>
    new CloudflareDoHResolver({ signal }),
) => {
  const startedAt = Date.now();
  const discovery = await runSubfinder(domain);
  const discoveryMs = Date.now() - startedAt;
  const results = discovery.discoveries
    .filter(({ host }) => isValidDomain(host) && host.endsWith(`.${domain}`))
    .map(({ host, sources }) => ({
      domain: host,
      sources: sources.toSorted(),
      stillExists: null as boolean | null,
    }))
    .toSorted((a, b) => a.domain.localeCompare(b.domain));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DETAILS_DEADLINE_MS);
  const resolver = createResolver(controller.signal);
  let nextIndex = 0;
  try {
    await Promise.all(
      Array.from(
        { length: Math.min(DETAILS_CONCURRENCY, results.length) },
        async () => {
          while (
            !controller.signal.aborted &&
            nextIndex < Math.min(results.length, DETAILED_RESULTS_LIMIT)
          ) {
            const result = results[nextIndex++];
            try {
              const response = await resolver.resolveAnswers(
                result.domain,
                'A',
              );
              if (!controller.signal.aborted)
                result.stillExists = response.answers.some(
                  (answer) => answer.type === 1,
                );
            } catch {
              // A failed DNS check says nothing about whether the discovered name exists.
            }
          }
        },
      ),
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  const uncheckedCount = results.filter(
    (result) => result.stillExists === null,
  ).length;
  log.info({
    message: 'subdomains_lookup_completed',
    domain,
    discoveryMs,
    durationMs: Date.now() - startedAt,
    resultCount: results.length,
    uncheckedCount,
    incomplete: discovery.incomplete,
  });
  return {
    results,
    discoveryIncomplete: discovery.incomplete,
    detailsReduced: uncheckedCount > 0,
    detailedResultsLimit: DETAILED_RESULTS_LIMIT,
  };
};
