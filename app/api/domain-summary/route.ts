import { NextResponse } from 'next/server';

import { useLogger, withEvlog } from '@/lib/evlog';
import { type ForSaleSummary, lookupForSale } from '@/lib/for-sale';
import { isValidDomain } from '@/lib/utils';
import { getWhoisSummary } from '@/lib/whois';

export type DomainSummaryResponse = {
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
    const [whois, sale] = await Promise.all([
      getWhoisSummary(domain),
      lookupForSale(domain).catch((error) => {
        log.set({ event: 'sale_lookup_failed' });
        log.error(error instanceof Error ? error : new Error(String(error)));
        return null;
      }),
    ]);

    return NextResponse.json({ whois, sale } satisfies DomainSummaryResponse, {
      headers: {
        // Retry a failed sale lookup soon instead of hiding a listing.
        'Cache-Control': sale
          ? 'public, max-age=600, s-maxage=1800'
          : 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (error) {
    log.set({ event: 'domain_summary_failed' });
    log.error(error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: true, message: 'Error fetching domain summary' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
});
