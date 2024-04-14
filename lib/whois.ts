import whoiser, { type WhoisSearchResult } from 'whoiser';

import { getBaseDomain, isValidDomain } from './utils';

export const lookupWhois = async (domain: string) => {
  const result = await whoiser(domain, {
    raw: true,
    timeout: 5000,
  });

  const mappedResults: Record<string, string> = {};
  for (const key in result) {
    mappedResults[key] = (result[key] as WhoisSearchResult).__raw as string;
  }

  const filteredResults = Object.entries(mappedResults).filter(
    ([_key, value]) => Boolean(value)
  );

  return filteredResults;
};

const UNREGISTERED_INDICATORS = [
  'no data found',
  'no match',
  'no object found',
  'not been registered',
  'not found',
  'status: free',
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
  domain: string
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
    const results = await whoiser(baseDomain, {
      timeout: 5000,
      raw: true,
    });

    const resultsKey = Object.keys(results).find(
      // @ts-expect-error
      (key) => !('error' in results[key])
    );
    if (!resultsKey) {
      throw new Error('No valid results found for domain ' + domain);
    }
    const firstResult = results[resultsKey] as WhoisSearchResult;

    if (
      UNREGISTERED_INDICATORS.some((indicator) =>
        firstResult['__raw'].toString().toLowerCase().includes(indicator)
      )
    ) {
      return {
        registered: false,
      };
    }

    return {
      registered: true,
      registrar: firstResult['Registrar']?.toString(),
      createdAt:
        firstResult && 'Created Date' in firstResult
          ? new Date(firstResult['Created Date'].toString()).toLocaleDateString(
              'en-US'
            )
          : null,
      dnssec: firstResult['DNSSEC']?.toString(),
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
