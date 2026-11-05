import { log } from 'evlog';
import { type firstResult, whoisDomain } from 'whoiser';

import { UserFacingError } from './user-facing-error';
import { getBaseDomain, isValidDomain, serializeError } from './utils';

export const formatDate = (date: Date) => date.toISOString().split('T')[0];

const parseDateSafe = (date: string): Date | null => {
  const parsed = new Date(date);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
};

type WhoisResponse = {
  server: string;
  data: ReturnType<typeof firstResult>;
  raw: string;
};

// The one way whoiser is called. whoiser resolves socket errors and timeouts
// as { error } per server, so a lookup no server answered rejects as well.
const queryWhois = async (domain: string): Promise<WhoisResponse[]> => {
  const results = Object.entries(
    await whoisDomain(domain, { raw: true, timeout: 5000 }),
  );
  const answered = results.filter(([, data]) => !('error' in data));
  if (!answered.length) {
    throw new Error(
      `No WHOIS server answered for ${domain}: ${results.map(([server, data]) => `${server}: ${data.error}`).join('; ')}`,
    );
  }

  return answered.map(([server, data]) => {
    const raw = data.__raw;
    return {
      server,
      data,
      raw: raw ? (Array.isArray(raw) ? raw.join('\n') : raw) : '',
    };
  });
};

export const lookupWhois = async (
  domain: string,
): Promise<[server: string, raw: string][]> => {
  let responses: WhoisResponse[];
  try {
    responses = await queryWhois(domain);
  } catch (error) {
    throw new UserFacingError(
      {
        title: 'WHOIS lookup failed',
        description:
          "We couldn't reach the WHOIS server for this domain. It may be temporarily unavailable or rate limiting our requests. Please try again shortly.",
        retryable: true,
      },
      { cause: error },
    );
  }

  return responses
    .filter(({ raw }) => raw)
    .map(({ server, raw }) => [server, raw]);
};

const UNREGISTERED_INDICATORS = [
  'domain not found',
  'no information available',
  'no se encuentra registrado', // ar
  'object_not_found', // mx
  'is free', // .nl
  'no data was found', // co.il
  'no entries found', // cz
  'no data found',
  'no information was found',
  'no match',
  'no object found',
  'not been registered',
  'does not exist', // top
  'not found',
  'status: free',
  'status: available', // eu
  'unassignable', // postiglione.sa.it
];

export type WhoisOutcome =
  | {
      status: 'registered';
      registrar: string | null;
      createdAt: string | null;
      dnssec: string | null;
    }
  | { status: 'unregistered' }
  // The lookup failed, so registration is neither confirmed nor ruled out.
  | { status: 'unknown' };

export const getWhoisOutcome = async (
  domain: string,
): Promise<WhoisOutcome> => {
  // TODO Allow resolving for TLDs
  if (!isValidDomain(domain)) return { status: 'unknown' };

  const baseDomain = getBaseDomain(domain);

  let response: WhoisResponse;
  try {
    [response] = await queryWhois(baseDomain);
  } catch (error) {
    // Swallowed into "Unavailable" tiles, so nothing else logs it.
    log.warn({
      message: 'whois_summary_failed',
      domain: baseDomain,
      error: serializeError(error),
    });
    return { status: 'unknown' };
  }

  const { data, raw } = response;
  if (
    UNREGISTERED_INDICATORS.some((indicator) =>
      raw.toLowerCase().includes(indicator),
    )
  ) {
    return { status: 'unregistered' };
  }

  const createdAt =
    'Created Date' in data
      ? parseDateSafe(data['Created Date'].toString())
      : null;
  return {
    status: 'registered',
    registrar: data['Registrar']?.toString() || null,
    createdAt: createdAt && formatDate(createdAt),
    dnssec: data['DNSSEC']?.toString() || null,
  };
};
