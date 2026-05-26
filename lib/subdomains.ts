import { spawn } from 'node:child_process';
import path from 'node:path';
import * as readline from 'node:readline';

import type { DnsResolver } from './resolvers/base';
import { UserFacingError } from './user-facing-error';
import { isValidDomain } from './utils';

const DETAILED_RESULTS_LIMIT = 500;
const SUBFINDER_TIMEOUT_SECONDS = 8;

const SUBFINDER_BIN =
  process.env.SUBFINDER_BIN ?? path.join(process.cwd(), 'bin', 'subfinder');

type SubfinderRecord = { host?: unknown; sources?: unknown };
type Discovery = { host: string; sources: string[] };

const runSubfinder = (domain: string): Promise<Discovery[]> =>
  new Promise((resolve, reject) => {
    const proc = spawn(
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
        env: { ...process.env, HOME: '/tmp' },
      },
    );

    const discoveries: Discovery[] = [];
    let stderr = '';

    const rl = readline.createInterface({ input: proc.stdout });
    rl.on('line', (line) => {
      if (!line) return;
      try {
        const record = JSON.parse(line) as SubfinderRecord;
        if (typeof record.host !== 'string') return;
        const sources = Array.isArray(record.sources)
          ? record.sources.filter((s): s is string => typeof s === 'string')
          : [];
        discoveries.push({ host: record.host, sources });
      } catch {
        // ignore malformed lines
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (error) => {
      reject(
        new UserFacingError(
          {
            title: "Couldn't run subdomain discovery",
            description:
              "We couldn't start the subdomain enumeration process. Please try again shortly.",
            retryable: true,
          },
          { cause: error },
        ),
      );
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(discoveries);
        return;
      }
      reject(
        new UserFacingError(
          {
            title: 'Subdomain discovery failed',
            description:
              'Our subdomain enumeration tool exited unexpectedly. Please try again shortly.',
            retryable: true,
          },
          {
            cause: new Error(`subfinder exited with code ${code}: ${stderr}`),
          },
        ),
      );
    });
  });

export const findSubdomains = async (
  domain: string,
  resolver: DnsResolver,
) => {
  const discoveries = (await runSubfinder(domain))
    .filter((d) => isValidDomain(d.host) && d.host.endsWith(`.${domain}`))
    .toSorted((a, b) => a.host.localeCompare(b.host));

  const results = await Promise.all(
    discoveries.map(async (entry, index) => {
      const sources = entry.sources.toSorted();

      // Limited to avoid subrequest limits in serverless functions.
      if (index >= DETAILED_RESULTS_LIMIT) {
        return { domain: entry.host, sources, stillExists: null };
      }

      const records = await resolver.resolveRecordType(entry.host, 'A');
      return {
        domain: entry.host,
        sources,
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
