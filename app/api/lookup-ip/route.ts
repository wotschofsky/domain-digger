import isIP from 'validator/lib/isIP';

import { applyRateLimit } from '@/lib/api';
import { getIpDetails } from '@/lib/ips';

export const runtime = 'edge';

export type IpLookupResponse = {
  city: string;
  country: string;
  isp: string;
  lat: number;
  lon: number;
  org: string;
  region: string;
  reverse: string[];
  timezone: string;
};

const ipv4ToDnsName = (ipv4: string) =>
  ipv4.split('.').reverse().join('.') + '.in-addr.arpa';

const ipv6ToDnsName = (ipv6: string) => {
  const segments = ipv6.split(':');
  const missingSegments = 8 - segments.length + (ipv6.includes('::') ? 1 : 0);
  const expandedSegments = segments.map((segment) => segment.padStart(4, '0'));
  for (let i = 0; i < missingSegments; i++) {
    expandedSegments.splice(segments.indexOf(''), 0, '0000');
  }
  const fullAddress = expandedSegments.join('');

  return (
    fullAddress
      .split('')
      .reverse()
      .join('.')
      .replace(/:/g, '')
      .split('.')
      .filter((x) => x)
      .join('.') + '.ip6.arpa'
  );
};

const lookupReverse = async (ip: string): Promise<string[]> => {
  const reverseDnsName = ip.includes(':')
    ? ipv6ToDnsName(ip)
    : ipv4ToDnsName(ip);

  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${reverseDnsName}&type=PTR`,
    {
      headers: { Accept: 'application/dns-json' },
    }
  );

  if (!response.ok)
    throw new Error(`Error fetching DNS records: ${response.statusText}`);

  const data = await response.json();

  return data.Answer
    ? data.Answer.map((record: { data: string }) => record.data.slice(0, -1))
    : [];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');

  if (!ip || !isIP(ip)) {
    return new Response(
      JSON.stringify({
        error: true,
        message: '"ip" param missing or invalid',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const visitorIp = request.headers.get('x-forwarded-for') ?? '';
  const identifier = ['lookup-ip', visitorIp].join(':');
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

  return new Response(
    JSON.stringify({
      reverse: reverse,
      isp: data.isp,
      org: data.org,
      country: data.country,
      region: data.regionName,
      city: data.city,
      timezone: data.timezone,
      lat: data.lat,
      lon: data.lon,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
