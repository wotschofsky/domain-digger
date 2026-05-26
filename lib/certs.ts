import pRetry from 'p-retry';

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

// Cache successful crt.sh responses to absorb transient outages and reduce
// the request volume that triggers their rate limiting. Non-OK responses
// aren't cached by Next.js, so an outage can't poison the cache.
const CRT_SH_REVALIDATE_SECONDS = 60 * 60;

const fetchCerts = async (domain: string) => {
  const url =
    'https://crt.sh?' +
    new URLSearchParams({ Identity: domain, output: 'json' });

  return pRetry(
    async (attemptNumber) => {
      const response = await fetch(url, {
        next: { revalidate: CRT_SH_REVALIDATE_SECONDS },
        // React memoizes identical fetches within a single Server Component
        // render, so without a unique key each retry would replay the prior
        // failed Response instead of hitting the network. A per-attempt header
        // busts the memoization key on retries while leaving the first
        // attempt eligible for normal Data Cache hits.
        headers:
          attemptNumber > 1
            ? { 'x-retry-attempt': String(attemptNumber) }
            : undefined,
      });
      // crt.sh regularly returns brief bursts of 429s and 502s that clear
      // within seconds. Throw so p-retry backs off; non-transient statuses
      // (including OK and other 4xx) flow through untouched.
      if (response.status === 429 || response.status >= 500) {
        throw new Error(
          `crt.sh responded with HTTP ${response.status} ${response.statusText}`,
        );
      }
      return response;
    },
    { retries: 2, minTimeout: 400, factor: 3, randomize: true },
  );
};

export const lookupCerts = async (domain: string): Promise<CertsData> => {
  let response: Response;
  try {
    response = await fetchCerts(domain);
  } catch (error) {
    throw new UserFacingError(
      {
        title: "Couldn't reach crt.sh",
        description:
          "We couldn't complete the request to crt.sh. Please try again shortly.",
        retryable: true,
      },
      { cause: error },
    );
  }

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

  const data: CertsData = await response.json();

  return data.filter((cert) =>
    cert.name_value
      .split(/\n/g)
      .some((value) => value === domain || value.endsWith(`.${domain}`)),
  );
};

export const lookupRelatedCerts = async (domain: string) => {
  const requests = [lookupCerts(domain)];

  const hasParentDomain = domain.split('.').filter(Boolean).length > 2;
  if (hasParentDomain) {
    const parentDomain = domain.split('.').slice(1).join('.');
    requests.push(lookupCerts(`*.${parentDomain}`));
  }

  const responses = await Promise.all(requests);

  const certs = responses
    .flat()
    .toSorted(
      (a, b) =>
        new Date(b.entry_timestamp).getTime() -
        new Date(a.entry_timestamp).getTime(),
    );

  return certs;
};
