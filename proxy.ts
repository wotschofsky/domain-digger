import { evlogMiddleware } from 'evlog/next';
import { type NextRequest, NextResponse } from 'next/server';

import { parseSearchInput } from './lib/search-parser';

const withEvlogHeaders = evlogMiddleware();

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== '/') {
    return withEvlogHeaders(request);
  }

  const url = request.nextUrl.clone();
  const searchTerm = url.searchParams.get('q')!;
  const parsed = parseSearchInput(searchTerm);

  switch (parsed.type) {
    case 'domain':
      // Redirect to the lookup page for valid domains
      url.pathname = `/lookup/${parsed.value}`;
      url.searchParams.delete('q');
      return NextResponse.redirect(url);
    // IP addresses can only be handled by the search form
    case 'ip':
    case 'invalid':
    case 'empty':
    default:
      // For invalid searches, redirect to home page
      url.searchParams.delete('q');
      return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    {
      source: '/',
      has: [{ type: 'query', key: 'q' }],
    },
  ],
};
