import { NextResponse } from 'next/server';
import isIP from 'validator/lib/isIP';

import { applyRateLimit } from '@/lib/api';
import { getIpDetails, lookupReverse } from '@/lib/ips';

export const runtime = 'edge';

export type IpLookupResponse = Pick<
  Awaited<ReturnType<typeof getIpDetails>>,
  'city' | 'country' | 'isp' | 'lat' | 'lon' | 'org' | 'region' | 'timezone'
> & {
  reverse: string[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');

  if (!ip || !isIP(ip)) {
    return NextResponse.json(
      {
        error: true,
        message: '"ip" param missing or invalid',
      },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const visitorIp = request.headers.get('x-forwarded-for') ?? '';
  const identifier = ['ip-details', visitorIp].join(':');
  const isAllowed = await applyRateLimit(identifier, 10, '60s');
  if (!isAllowed) {
    return new Response('Too many requests', {
      status: 429,
    });
  }

  const [data, reverse] = await Promise.all([
    getIpDetails(ip),
    lookupReverse(ip),
  ]);

  return NextResponse.json(
    {
      reverse: reverse,
      isp: data.isp,
      org: data.org,
      country: data.country,
      region: data.regionName,
      city: data.city,
      timezone: data.timezone,
      lat: data.lat,
      lon: data.lon,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=1800',
        'Content-Type': 'application/json',
      },
    }
  );
}
