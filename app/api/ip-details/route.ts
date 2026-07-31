import { NextResponse } from 'next/server';
import isIP from 'validator/lib/isIP';

import { useLogger, withEvlog } from '@/lib/evlog';
import { getIpDetails, lookupReverse } from '@/lib/ips';

export type IpLookupResponse = Pick<
  Awaited<ReturnType<typeof getIpDetails>>,
  'city' | 'country' | 'isp' | 'lat' | 'lon' | 'org' | 'region' | 'timezone'
> & {
  reverse: string[];
};

export const GET = withEvlog(async (request: Request) => {
  const log = useLogger();
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');

  if (!ip || !isIP(ip)) {
    log.set({ status: 400, reason: 'invalid_ip', hasIp: Boolean(ip) });
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
      },
    );
  }

  const [data, reverse] = await Promise.all([
    getIpDetails(ip),
    lookupReverse(ip),
  ]);

  log.set({
    ip,
    reverseCount: reverse.length,
    country: data.country,
    region: data.regionName,
  });

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
    },
  );
});
