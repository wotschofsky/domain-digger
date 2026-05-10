import { type NextRequest, NextResponse } from 'next/server';

import { useLogger, withEvlog } from '@/lib/evlog';
import { getVisitorIp } from '@/lib/api';

export const GET = withEvlog(async (request: NextRequest) => {
  const log = useLogger();
  const ip = getVisitorIp(request.headers);
  log.set({ ip });

  return NextResponse.json({ ip });
});
