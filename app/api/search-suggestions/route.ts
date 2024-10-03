import { NextResponse } from 'next/server';

import { getSearchSuggestions } from '@/lib/search';

export const runtime = 'edge';
export const preferredRegion = 'home';

const VALID_QUERY_REGEX = /^[a-z0-9-_.]+$/i;

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return new Response('Missing query', {
      status: 400,
    });
  }

  const suggestions = VALID_QUERY_REGEX.test(query)
    ? await getSearchSuggestions(query)
    : [];

  return NextResponse.json(suggestions, {
    headers: {
      'Cache-Control': 'public, s-maxage=21600',
    },
  });
};
