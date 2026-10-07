import { NextResponse } from 'next/server';

import { useLogger, withEvlog } from '@/lib/evlog';
import { type ForSaleSummary, lookupForSale } from '@/lib/for-sale';
import { isValidDomain } from '@/lib/utils';

export type ForSaleResponse = ForSaleSummary;

export const GET = withEvlog(async (request: Request) => {
  const domain = new URL(request.url).searchParams.get('domain');
  if (!domain || !isValidDomain(domain)) {
    return NextResponse.json(
      { error: true, message: 'Invalid domain' },
      {
        status: 400,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
  const log = useLogger();
  log.set({ domain });
  try {
    const { summary, ttl } = await lookupForSale(domain);
    return NextResponse.json(summary, {
      headers: {
        'Cache-Control':
          ttl > 0 ? `public, max-age=${ttl}, s-maxage=${ttl}` : 'no-store',
      },
    });
  } catch (error) {
    log.set({ event: 'for_sale_lookup_failed' });
    log.error(error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: true, message: 'Sale information unavailable' },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
});
