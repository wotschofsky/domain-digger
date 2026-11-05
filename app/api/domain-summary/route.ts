import { NextResponse } from 'next/server';

import { log, useLogger, withEvlog } from '@/lib/evlog';
import { type ForSaleSummary, lookupForSale } from '@/lib/for-sale';
import { AuthoritativeResolver } from '@/lib/resolvers/authoritative';
import { UserFacingError } from '@/lib/user-facing-error';
import { getBaseDomain, isValidDomain } from '@/lib/utils';
import { getWhoisSummary } from '@/lib/whois';

export type DomainSummaryResponse = {
  whois: Awaited<ReturnType<typeof getWhoisSummary>>;
  // Whether the parent zone publishes DS records; null when the lookup failed.
  dnssec: boolean | null;
  // null when the sale lookup failed; WHOIS is still returned.
  sale: ForSaleSummary | null;
};

// Matches the WHOIS timeout, so the summary waits no longer than it already
// does; the resolver's own fallback budget (15s) would hit the function limit.
const DS_DEADLINE_MS = 5000;

const isDelegationSigned = async (domain: string): Promise<boolean> => {
  let timer: NodeJS.Timeout | undefined;

  try {
    const { answers } = await Promise.race([
      new AuthoritativeResolver().resolveAnswers(getBaseDomain(domain), 'DS'),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new UserFacingError({
                title: 'DS lookup timed out',
                description: `The parent zone did not answer within ${DS_DEADLINE_MS}ms.`,
                retryable: true,
              }),
            ),
          DS_DEADLINE_MS,
        );
      }),
    ]);

    return answers.length > 0;
  } finally {
    clearTimeout(timer);
  }
};

export const GET = withEvlog(async (request: Request) => {
  const logger = useLogger();
  const domain = new URL(request.url).searchParams.get('domain');

  if (!domain || !isValidDomain(domain)) {
    logger.set({ status: 400, reason: 'invalid_domain' });
    return NextResponse.json(
      { error: true, message: 'Invalid domain' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  logger.set({ domain });

  try {
    const [whois, dnssec, sale] = await Promise.all([
      getWhoisSummary(domain),
      isDelegationSigned(domain).catch((error) => {
        // Unresponsive nameservers are routine; error alerts stay reserved for bugs.
        if (error instanceof UserFacingError) {
          log.warn({ message: 'ds_lookup_failed', domain, error });
        } else {
          logger.set({ event: 'ds_lookup_failed' });
          logger.error(
            error instanceof Error ? error : new Error(String(error)),
          );
        }

        return null;
      }),
      lookupForSale(domain).catch((error) => {
        logger.set({ event: 'sale_lookup_failed' });
        logger.error(error instanceof Error ? error : new Error(String(error)));
        return null;
      }),
    ]);

    // Tells a failed WHOIS apart from a registry without a registrar or
    // creation date field: both read "Unavailable".
    logger.set({ whois, dnssec });

    return NextResponse.json(
      { whois, dnssec, sale } satisfies DomainSummaryResponse,
      {
        headers: {
          // Retry a failed lookup soon instead of hiding a listing.
          'Cache-Control':
            sale && dnssec !== null && !(whois.registered && whois.unknown)
              ? 'public, max-age=600, s-maxage=1800'
              : 'public, max-age=60, s-maxage=60',
        },
      },
    );
  } catch (error) {
    logger.set({ event: 'domain_summary_failed' });
    logger.error(error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: true, message: 'Error fetching domain summary' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
});
