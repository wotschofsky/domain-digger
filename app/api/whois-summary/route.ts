import { applyRateLimit } from '@/lib/api';
import { getWhoisSummary } from '@/lib/whois';

export type WhoisSummaryResponse = Awaited<ReturnType<typeof getWhoisSummary>>;
export type WhoisSummaryErrorResponse = { error: true; message: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return Response.json(
      { error: true, message: 'No domain provided' },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  const visitorIp = request.headers.get('x-forwarded-for') ?? '';
  const identifier = ['whois-summary', visitorIp].join(':');
  const isAllowed = await applyRateLimit(identifier, 5, '60s');
  if (!isAllowed) {
    return new Response('Too many requests', {
      status: 429,
    });
  }

  try {
    const summary = await getWhoisSummary(domain);
    return Response.json(summary, {
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=1800',
      },
    });
  } catch (error) {
    return Response.json(
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
