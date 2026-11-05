import { NextResponse } from 'next/server';

import { getDnssecSummary } from '@/lib/dnssec/summary';
import { useLogger, withEvlog } from '@/lib/evlog';
import { type ForSaleSummary, lookupForSale } from '@/lib/for-sale';
import { measureLookup } from '@/lib/lookup-observability';
import { isValidDomain } from '@/lib/utils';
import { getWhoisSummary } from '@/lib/whois';

export type DomainSummaryResponse = {
  dnssec: Awaited<ReturnType<typeof getDnssecSummary>>;
  whois: Awaited<ReturnType<typeof getWhoisSummary>>;
  // null when the sale lookup failed; WHOIS is still returned.
  sale: ForSaleSummary | null;
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

  try {
    const [whois, sale, dnssec] = await Promise.all([
      measureLookup('registration_summary', domain, () =>
        getWhoisSummary(domain),
      ),
      measureLookup('sale_summary', domain, () => lookupForSale(domain)).catch(
        (error) => {
          log.set({ event: 'sale_lookup_failed' });
          log.error(error instanceof Error ? error : new Error(String(error)));
          return null;
        },
      ),
      measureLookup('dnssec_summary', domain, () => getDnssecSummary(domain)),
    ]);

    // Log returned states too: a resolved stage can still be unknown WHOIS or unavailable DNSSEC.
    log.set({ whois, dnssec });

    return NextResponse.json(
      { whois, sale, dnssec } satisfies DomainSummaryResponse,
      {
        headers: {
          // Retry a failed lookup soon instead of hiding a listing.
          'Cache-Control':
            sale &&
            dnssec.status !== 'unavailable' &&
            !(whois.registered && whois.unknown)
              ? 'public, max-age=600, s-maxage=1800'
              : 'public, max-age=60, s-maxage=60',
        },
      },
    );
  } catch (error) {
    log.set({ event: 'domain_summary_failed' });
    log.error(error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: true, message: 'Error fetching domain summary' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
});
