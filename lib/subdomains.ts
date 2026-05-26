import { spawn } from 'node:child_process';
import path from 'node:path';
import * as readline from 'node:readline';

import type { DnsResolver } from './resolvers/base';
import { UserFacingError } from './user-facing-error';
import { deduplicate, isValidDomain } from './utils';

const DETAILED_RESULTS_LIMIT = 500;
const SUBFINDER_TIMEOUT_SECONDS = 8;

const SUBFINDER_BIN =
  process.env.SUBFINDER_BIN ?? path.join(process.cwd(), 'bin', 'subfinder');

type SubfinderRecord = { host?: unknown };

const runSubfinder = (domain: string): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const proc = spawn(
      SUBFINDER_BIN,
      [
        '-d',
        domain,
        '-json',
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

    const hosts: string[] = [];
    let stderr = '';

    const rl = readline.createInterface({ input: proc.stdout });
    rl.on('line', (line) => {
      if (!line) return;
      try {
        const record = JSON.parse(line) as SubfinderRecord;
        if (typeof record.host === 'string') {
          hosts.push(record.host);
        }
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
        resolve(hosts);
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
  const hosts = await runSubfinder(domain);

  const uniqueDomains = deduplicate(hosts)
    .filter(isValidDomain)
    .filter((d) => d.endsWith(`.${domain}`))
    .toSorted((a, b) => a.localeCompare(b));

  const results = await Promise.all(
    uniqueDomains.map(async (entry, index) => {
      // Limited to avoid subrequest limits in serverless functions.
      if (index >= DETAILED_RESULTS_LIMIT) {
        return { domain: entry, stillExists: null };
      }

      const records = await resolver.resolveRecordType(entry, 'A');
      return {
        domain: entry,
        stillExists: records.records.length > 0,
      };
    }),
  );

  return {
    results,
    detailsReduced: uniqueDomains.length > DETAILED_RESULTS_LIMIT,
    detailedResultsLimit: DETAILED_RESULTS_LIMIT,
  };
};
