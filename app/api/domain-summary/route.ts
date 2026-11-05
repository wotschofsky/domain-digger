import { NextResponse } from 'next/server';

import { getDomainSummary } from '@/lib/domain-summary';
import { useLogger, withEvlog } from '@/lib/evlog';
import { isValidDomain } from '@/lib/utils';

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

  const { tiles, complete, saleError } = await getDomainSummary(domain);

  if (saleError) {
    log.set({ event: 'sale_lookup_failed' });
    log.error(saleError);
  }
  // The status tells a failed WHOIS lookup ("Unavailable") apart from a
  // registry that leaves fields out ("Not listed").
  log.set({ tiles });

  return NextResponse.json(tiles, {
    headers: {
      'Cache-Control': complete
        ? 'public, max-age=600, s-maxage=1800'
        : 'public, max-age=60, s-maxage=60',
    },
  });
});
