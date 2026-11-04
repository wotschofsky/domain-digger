import { log } from 'evlog';
import { cacheLife } from 'next/cache';
import { z } from 'zod';

import { UserFacingError } from './user-facing-error';

export type CertsData = {
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  id: number;
  entry_timestamp: string;
  not_before: string;
  not_after: string;
  serial_number: string;
}[];

const certsSchema = z.array(
  z.object({
    issuer_ca_id: z.number(),
    issuer_name: z.string(),
    common_name: z.string(),
    name_value: z.string(),
    id: z.number(),
    // crt.sh's JSON no longer returns entry_timestamp; requiring it rejects every row.
    entry_timestamp: z.string().default(''),
    not_before: z.string(),
    not_after: z.string(),
    serial_number: z.string(),
  }),
);

export const lookupCerts = async (domain: string): Promise<CertsData> => {
  'use cache';
  cacheLife({ stale: 60, revalidate: 600, expire: 3600 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      'https://crt.sh?' +
        new URLSearchParams({ Identity: domain, output: 'json' }),
      { signal: controller.signal },
    );
    if (!response.ok) {
      throw new UserFacingError(
        {
          title: 'crt.sh is unavailable',
          description:
            'crt.sh returned an error and may be temporarily down. Please try again shortly.',
          retryable: true,
        },
        {
          cause: new Error(
            `crt.sh responded with HTTP ${response.status} ${response.statusText}`,
          ),
        },
      );
    }
    const data = certsSchema.parse(await response.json());
    return data.filter((cert) =>
      cert.name_value
        .split(/\n/g)
        .some((value) => value === domain || value.endsWith(`.${domain}`)),
    );
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError(
      {
        title: "Couldn't complete the crt.sh lookup",
        description:
          "We couldn't reach crt.sh, the lookup timed out, or it returned an invalid response. Please try again shortly.",
        retryable: true,
      },
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
};

export const lookupRelatedCerts = async (domain: string) => {
  const startedAt = Date.now();
  const requests = [lookupCerts(domain)];

  const hasParentDomain = domain.split('.').filter(Boolean).length > 2;
  if (hasParentDomain) {
    const parentDomain = domain.split('.').slice(1).join('.');
    requests.push(lookupCerts(`*.${parentDomain}`));
  }

  const responses = await Promise.allSettled(requests);
  const successes = responses.filter(
    (response) => response.status === 'fulfilled',
  );
  const failures = responses.filter(
    (response) => response.status === 'rejected',
  );
  for (const failure of failures) {
    log.warn({
      message: 'certificate_query_failed',
      domain,
      error: failure.reason,
    });
  }
  if (!successes.length) throw failures[0].reason;

  const certs = [
    ...new Map(
      successes
        .flatMap((response) => response.value)
        .map((cert) => [cert.id, cert]),
    ).values(),
  ].toSorted(
    (a, b) =>
      new Date(b.entry_timestamp).getTime() -
      new Date(a.entry_timestamp).getTime(),
  );

  log.info({
    message: 'certificate_lookup_completed',
    domain,
    durationMs: Date.now() - startedAt,
    resultCount: certs.length,
    failedQueries: failures.length,
  });
  return { certs, incomplete: failures.length > 0 };
};
