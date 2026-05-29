import { NextResponse } from 'next/server';

import { useLogger, withEvlog } from '@/lib/evlog';
import { getStargazersSummary } from '@/lib/github';

export const GET = withEvlog(async () => {
  const log = useLogger();

  try {
    const stargazers = await getStargazersSummary(
      'wotschofsky',
      'domain-digger',
    );

    log.set({ stargazerCount: stargazers.recentStargazers.length });

    return NextResponse.json(stargazers, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600',
      },
    });
  } catch (error) {
    log.set({ event: 'stargazers_summary_failed' });
    log.error(error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: 'Failed to fetch recent stargazers' },
      { status: 500 },
    );
  }
});
