import { type NextRequest, NextResponse } from 'next/server';

import { applyRateLimit } from './lib/api';

export const middleware = async (request: NextRequest) => {
  const visitorIp = request.headers.get('x-forwarded-for') ?? '';
  const identifier = ['lookup-page', visitorIp].join(':');
  const isAllowed = await applyRateLimit(identifier, 10, '60s');

  if (!isAllowed) {
    return NextResponse.rewrite(new URL('/too-many-requests', request.url), {
      status: 429,
    });
  }

  return NextResponse.next();
};

export const config = {
  matcher: [
    {
      source: '/lookup/:domain*',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
