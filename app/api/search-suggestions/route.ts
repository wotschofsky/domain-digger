import { NextResponse } from 'next/server';

import { applyRateLimit } from '@/lib/api';
import { getSearchSuggestions } from '@/lib/search';

export const runtime = 'edge';
export const preferredRegion = 'home';

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return new Response('Missing query', {
      status: 400,
    });
  }

  if (query.includes('%')) {
    return new Response('Invalid query', {
      status: 400,
    });
  }

  const visitorIp = request.headers.get('x-forwarded-for') ?? '';
  const identifier = ['search-suggestions', visitorIp].join(':');
  const isAllowed = await applyRateLimit(identifier, 15, '60s');
  if (!isAllowed) {
    return new Response('Too many requests', {
      status: 429,
    });
  }

  const suggestions = await getSearchSuggestions(query);

  return NextResponse.json(suggestions, {
    headers: {
      'Cache-Control': 'public, s-maxage=600',
    },
  });
};
