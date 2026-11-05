import { forSaleName, lookupForSale } from './for-sale';
import { formatSalePrice } from './format-sale-price';
import { getWhoisOutcome } from './whois';

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

export const getDomainSummary = async (
  domain: string,
): Promise<{
  tiles: DomainSummaryTiles;
  // Both lookups answered, so the tiles may be cached for long; a failed
  // lookup is retried soon instead of hiding a listing.
  complete: boolean;
  // Why the sale lookup failed, for the caller to log.
  saleError: Error | null;
}> => {
  let saleError: Error | null = null;
  const [whois, sale] = await Promise.all([
    getWhoisOutcome(domain),
    lookupForSale(domain).catch((error: unknown) => {
      saleError = error instanceof Error ? error : new Error(String(error));
      return null;
    }),
  ]);
  const complete = sale !== null && whois.status !== 'unknown';

  if (whois.status === 'unregistered') {
    return { tiles: { status: 'unregistered' }, complete, saleError };
  }

  const known = whois.status === 'registered' ? whois : null;
  // Registries may omit fields (DENIC: no registrar or date); only a failed
  // lookup is unavailable.
  const missing = known ? 'Not listed' : 'Unavailable';

  return {
    tiles: {
      status: whois.status,
      registrar: known?.registrar || missing,
      createdAt: known?.createdAt || missing,
      dnssec: known?.dnssec || missing,
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
    },
    complete,
    saleError,
  };
};
