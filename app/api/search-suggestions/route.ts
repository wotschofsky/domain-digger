import { NextResponse } from 'next/server';

import { useLogger, withEvlog } from '@/lib/evlog';
import { getSearchSuggestions } from '@/lib/search';
import { normalizeDomain } from '@/lib/search-parser';

export const preferredRegion = 'home';

const VALID_QUERY_REGEX = /^[a-z0-9-_.]+$/i;

export const GET = withEvlog(async (request: Request) => {
  const log = useLogger();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    log.set({ status: 400, reason: 'missing_query' });
    return new Response('Missing query', {
      status: 400,
    });
  }

  if (query !== normalizeDomain(query)) {
    log.set({ status: 400, reason: 'not_normalized' });
    return new Response('Query is not normalized', {
      status: 400,
    });
  }

  log.set({ query });

  const suggestions = VALID_QUERY_REGEX.test(query)
    ? await getSearchSuggestions(query)
    : [];

  log.set({ suggestionCount: suggestions.length });

  return NextResponse.json(suggestions, {
    headers: {
      'Cache-Control': 'public, s-maxage=21600',
    },
  });
});
