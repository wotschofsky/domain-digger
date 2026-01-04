import { type NextRequest, NextResponse } from 'next/server';

import { getVisitorIp } from '@/lib/api';

export const GET = async (request: NextRequest) => {
  const ip = getVisitorIp(request.headers);

  return NextResponse.json({ ip });
};
