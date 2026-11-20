import { NextResponse } from 'next/server';

import { type DnssecSummary, getDnssecSummary } from '@/lib/dnssec/summary';
import { useLogger, withEvlog } from '@/lib/evlog';
import {
  forSaleName,
  type ForSaleSummary,
  lookupForSale,
} from '@/lib/for-sale';
import { formatSalePrice } from '@/lib/format-sale-price';
import { measureLookup } from '@/lib/lookup-observability';
import { isValidDomain } from '@/lib/utils';
import { getWhoisOutcome, type WhoisOutcome } from '@/lib/whois';

// What the summary tiles show, decided here so the browser only renders it.
export type DomainSummaryTiles =
  | { status: 'unregistered' }
  | {
      // "unknown" when the WHOIS lookup failed and registration is assumed.
      status: 'registered' | 'unknown';
      registrar: string;
      createdAt: string;
      // From the parent's DS records, not WHOIS, so it shows even when WHOIS
      // fails; `domain` is the registrable domain the records were read for.
      dnssec: { value: string; domain: string };
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

const describeDnssecStatus = (status: DnssecSummary['status']): string => {
  if (status === 'ds-present') return 'DS present';
  if (status === 'no-ds') return 'No DS record';
  return 'Unavailable';
};

const toTiles = (
  domain: string,
  whois: WhoisOutcome,
  sale: ForSaleSummary | null,
  dnssec: DnssecSummary,
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
    dnssec: {
      value: describeDnssecStatus(dnssec.status),
      domain: dnssec.domain,
    },
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
  const log = useLogger();
  const domain = new URL(request.url).searchParams.get('domain');

  if (!domain || !isValidDomain(domain)) {
    log.set({ status: 400, reason: 'invalid_domain' });
    return NextResponse.json(
      { error: true, message: 'Invalid domain' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  log.set({ domain });

  const [whois, sale, dnssec] = await Promise.all([
    measureLookup('registration_summary', domain, () =>
      getWhoisOutcome(domain),
    ),
    measureLookup('sale_summary', domain, () => lookupForSale(domain)).catch(
      (error: unknown) => {
        log.set({ event: 'sale_lookup_failed' });
        log.error(error instanceof Error ? error : new Error(String(error)));
        return null;
      },
    ),
    measureLookup('dnssec_summary', domain, () => getDnssecSummary(domain)),
  ]);

  const tiles = toTiles(domain, whois, sale, dnssec);
  // Log returned states too: a resolved stage can still be unknown WHOIS
  // ("Unavailable", unlike a registry that leaves fields out: "Not listed")
  // or unavailable DNSSEC.
  log.set({ tiles });

  return NextResponse.json(tiles, {
    headers: {
      // Retry a failed lookup soon instead of hiding a listing.
      'Cache-Control':
        sale && whois.status !== 'unknown' && dnssec.status !== 'unavailable'
          ? 'public, max-age=600, s-maxage=1800'
          : 'public, max-age=60, s-maxage=60',
    },
  });
});
