import { log } from 'evlog';
import { NextResponse } from 'next/server';

import { getStargazersSummary } from '@/lib/github';

export const runtime = 'edge';
export const preferredRegion = 'home';

export const GET = async () => {
  try {
    const stargazers = await getStargazersSummary(
      'wotschofsky',
      'domain-digger',
    );

    return NextResponse.json(stargazers, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600',
      },
    });
  } catch (error) {
    log.error({ message: 'stargazers_summary_failed', error });

    return NextResponse.json(
      { error: 'Failed to fetch recent stargazers' },
      { status: 500 },
    );
  }
};
