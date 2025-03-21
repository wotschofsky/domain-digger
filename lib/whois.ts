import { firstResult as getFirstResult, whoisDomain } from 'whoiser';

import { getBaseDomain, isValidDomain } from './utils';

export const formatDate = (date: Date) => date.toISOString().split('T')[0];

const parseDateSafe = (date: string): Date | null => {
  const parsed = new Date(date);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
};

type WhoisResult = {
  [key: string]: {
    __raw: string;
    [key: string]: unknown;
  };
};

export const lookupWhois = async (domain: string) => {
  const result = (await whoisDomain(domain, {
    raw: true,
    timeout: 5000,
  })) as WhoisResult;

  const mappedResults: Record<string, string> = {};
  for (const key in result) {
    mappedResults[key] = result[key].__raw as string;
  }

  const filteredResults = Object.entries(mappedResults).filter(
    ([_key, value]) => Boolean(value),
  );

  return filteredResults;
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

type WhoisSummary =
  | {
      registered: false;
    }
  | {
      registered: true;
      registrar: string | null;
      createdAt: string | null;
      dnssec: string | null;
    };

export const getWhoisSummary = async (
  domain: string,
): Promise<WhoisSummary> => {
  // TODO Allow resolving for TLDs
  if (!isValidDomain(domain)) {
    return {
      registered: true,
      registrar: null,
      createdAt: null,
      dnssec: null,
    };
  }

  const baseDomain = getBaseDomain(domain);

  try {
    const results = (await whoisDomain(baseDomain, {
      timeout: 5000,
      raw: true,
    })) as WhoisResult;

    const firstResult = getFirstResult(results);

    if (!firstResult) {
      throw new Error('No valid result found for domain ' + domain);
    }

    if (
      UNREGISTERED_INDICATORS.some((indicator) =>
        firstResult['__raw'].toString().toLowerCase().includes(indicator),
      )
    ) {
      return {
        registered: false,
      };
    }

    const createdAt =
      firstResult && 'Created Date' in firstResult
        ? parseDateSafe(firstResult['Created Date'].toString())
        : null;
    return {
      registered: true,
      registrar: firstResult['Registrar']?.toString() || null,
      createdAt: createdAt && formatDate(createdAt),
      dnssec: firstResult['DNSSEC']?.toString() || null,
    };
  } catch (error) {
    console.error(error);
    return {
      registered: true,
      registrar: null,
      createdAt: null,
      dnssec: null,
    };
  }
};
