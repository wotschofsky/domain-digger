import path from 'node:path';

import { execa } from 'execa';
import { z } from 'zod';

import type { DnsResolver } from './resolvers/base';
import { UserFacingError } from './user-facing-error';
import { isValidDomain } from './utils';

const DETAILED_RESULTS_LIMIT = 500;
const SUBFINDER_TIMEOUT_SECONDS = 8;

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
      },
    );

    return stdout
      .split('\n')
      .map(readDiscovery)
      .filter((discovery): discovery is Discovery => discovery !== null);
  } catch (error) {
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

export const findSubdomains = async (domain: string, resolver: DnsResolver) => {
  const discoveries = (await runSubfinder(domain))
    .filter(({ host }) => isValidDomain(host) && host.endsWith(`.${domain}`))
    .map(({ host, sources }) => ({
      domain: host,
      sources: sources.toSorted(),
    }))
    .toSorted((a, b) => a.domain.localeCompare(b.domain));

  const results = await Promise.all(
    discoveries.map(async (discovery, index) => {
      // Limited to avoid subrequest limits in serverless functions.
      if (index >= DETAILED_RESULTS_LIMIT) {
        return { ...discovery, stillExists: null };
      }

      const records = await resolver.resolveRecordType(discovery.domain, 'A');
      return {
        ...discovery,
        stillExists: records.records.length > 0,
      };
    }),
  );

  return {
    results,
    detailsReduced: discoveries.length > DETAILED_RESULTS_LIMIT,
    detailedResultsLimit: DETAILED_RESULTS_LIMIT,
  };
};
