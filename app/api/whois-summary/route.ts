import { NextResponse } from 'next/server';

import { getWhoisSummary } from '@/lib/whois';

export type WhoisSummaryResponse = Awaited<ReturnType<typeof getWhoisSummary>>;
export type WhoisSummaryErrorResponse = { error: true; message: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json(
      { error: true, message: 'No domain provided' },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  try {
    const summary = await getWhoisSummary(domain);
    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=1800',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: true, message: 'Error fetching whois summary' },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
