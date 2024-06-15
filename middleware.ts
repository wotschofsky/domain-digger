import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/env';
import { applyRateLimit, isUserBot } from '@/lib/api';

export const middleware = async (request: NextRequest) => {
  if (env.ALLOWED_BOTS) {
    const { isBot, userAgent } = isUserBot(request.headers);
    if (isBot) {
      const isAllowedBot =
        !!userAgent &&
        env.ALLOWED_BOTS.some((name) => userAgent.toLowerCase().includes(name));

      if (!isAllowedBot) {
        return new Response('Forbidden', { status: 403 });
      }
    }
  }

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
