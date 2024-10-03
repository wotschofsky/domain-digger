import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/env';
import { isUserBot } from '@/lib/api';

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
