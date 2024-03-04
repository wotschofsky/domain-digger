import { getDomain } from 'tldts';
import whoiser, { WhoisSearchResult } from 'whoiser';

import { isValidDomain } from '@/lib/utils';

const UNREGISTERED_INDICATORS = [
  'no data found',
  'no match',
  'no object found',
  'not been registered',
  'not found',
  'status: free',
];

export type WhoisSummaryResponse =
  | {
      registered: false;
    }
  | {
      registered: true;
      registrar: string | null;
      createdAt: string | null;
      dnssec: string | null;
    };

export type WhoisSummaryErrorResponse = { error: true; message: string };

const getSummary = async (domain: string): Promise<WhoisSummaryResponse> => {
  // TODO Allow resolving for TLDs
  if (!isValidDomain(domain)) {
    return {
      registered: true,
      registrar: null,
      createdAt: null,
      dnssec: null,
    };
  }

  const rawDomain = getDomain(domain) || domain;

  try {
    const results = await whoiser(rawDomain, {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return Response.json(
      { error: true, message: 'No domain provided' },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    const summary = await getSummary(domain);
    return Response.json(summary, {
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=1800',
      },
    });
  } catch (error) {
    return Response.json(
      { error: true, message: 'Error fetching whois summary' },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
