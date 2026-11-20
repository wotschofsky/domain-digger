import { NextResponse } from 'next/server';

import { log, useLogger, withEvlog } from '@/lib/evlog';
import {
  forSaleName,
  type ForSaleSummary,
  lookupForSale,
} from '@/lib/for-sale';
import { formatSalePrice } from '@/lib/format-sale-price';
import { AuthoritativeResolver } from '@/lib/resolvers/authoritative';
import { UserFacingError } from '@/lib/user-facing-error';
import { getBaseDomain, isValidDomain } from '@/lib/utils';
import { getWhoisOutcome, type WhoisOutcome } from '@/lib/whois';

// What the summary tiles show, decided here so the browser only renders it.
export type DomainSummaryTiles =
  | { status: 'unregistered' }
  | {
      // "unknown" when the WHOIS lookup failed and registration is assumed.
      status: 'registered' | 'unknown';
      registrar: string;
      createdAt: string;
      dnssec: string;
      sale: {
        // The registrable domain the listing sits on, when it isn't the
        // searched name.
        fallbackDomain: string | null;
        // Formatted for display; empty when the listing names no price.
        prices: string[];
        // A website, else an email address.
        link: string | null;
      } | null;
    };

// Matches the WHOIS timeout, so the summary waits no longer than it already
// does; the resolver's default walk timeout (8s) leaves less room under the
// function limit.
const DS_DEADLINE_MS = 5000;

// Whether the parent zone publishes DS records for the registered domain.
// Unlike WHOIS, this works for every TLD.
const isDelegationSigned = async (domain: string): Promise<boolean> => {
  const { answers } = await new AuthoritativeResolver({
    timeoutMs: DS_DEADLINE_MS,
  }).resolveAnswers(getBaseDomain(domain), 'DS');
  return answers.length > 0;
};

const describeDnssec = (signed: boolean | null): string => {
  if (signed === null) return 'Unavailable';
  return signed ? 'Signed' : 'Unsigned';
};

const toTiles = (
  domain: string,
  whois: WhoisOutcome,
  dnssec: boolean | null,
  sale: ForSaleSummary | null,
): DomainSummaryTiles => {
  if (whois.status === 'unregistered') return { status: 'unregistered' };

  const known = whois.status === 'registered' ? whois : null;
  // Registries may omit fields (DENIC: no registrar or date); only a failed
  // lookup is unavailable.
  const missing = known ? 'Not listed' : 'Unavailable';

  return {
    status: whois.status,
    registrar: known?.registrar || missing,
    createdAt: known?.createdAt || missing,
    // Read from DNS, so it stands even when the WHOIS lookup failed.
    dnssec: describeDnssec(dnssec),
    // No sale tile when the WHOIS lookup failed and registration is only
    // assumed.
    sale:
      known && sale?.listing
        ? {
            fallbackDomain:
              sale.domain === forSaleName(domain) ? null : sale.domain,
            prices: sale.listing.prices.map(formatSalePrice),
            // Links arrive most preferred first (https, http, mailto, tel);
            // a phone number is not linked.
            link:
              sale.listing.links.find((link) => !link.startsWith('tel:')) ??
              null,
          }
        : null,
  };
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

  const [whois, dnssec, sale] = await Promise.all([
    getWhoisOutcome(domain),
    isDelegationSigned(domain).catch((error: unknown) => {
      // Unresponsive nameservers are routine; error alerts stay reserved for
      // bugs.
      if (error instanceof UserFacingError) {
        log.warn({ message: 'ds_lookup_failed', domain, error });
      } else {
        logger.set({ event: 'ds_lookup_failed' });
        logger.error(error instanceof Error ? error : new Error(String(error)));
      }
      return null;
    }),
    lookupForSale(domain).catch((error: unknown) => {
      logger.set({ event: 'sale_lookup_failed' });
      logger.error(error instanceof Error ? error : new Error(String(error)));
      return null;
    }),
  ]);

  const tiles = toTiles(domain, whois, dnssec, sale);
  // The status tells a failed WHOIS lookup ("Unavailable") apart from a
  // registry that leaves fields out ("Not listed").
  logger.set({ tiles });

  return NextResponse.json(tiles, {
    headers: {
      // Retry a failed lookup soon instead of hiding a listing.
      'Cache-Control':
        sale && dnssec !== null && whois.status !== 'unknown'
          ? 'public, max-age=600, s-maxage=1800'
          : 'public, max-age=60, s-maxage=60',
    },
  });
});
