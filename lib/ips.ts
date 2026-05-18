import DataLoader from 'dataloader';
import isIP from 'validator/lib/isIP';

import { UserFacingError } from './user-facing-error';

type IpDetails = {
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  query: string;
};

export const getIpDetails = async (ip: string) => {
  if (!isIP(ip))
    throw new UserFacingError({
      title: 'Invalid IP address',
      description: 'The provided IP address is not valid.',
    });

  const url = new URL(`http://ip-api.com/json/${encodeURIComponent(ip)}`);
  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    throw new UserFacingError(
      {
        title: "Couldn't reach ip-api.com",
        description:
          "We couldn't complete the request to ip-api.com. Please try again shortly.",
        retryable: true,
      },
      { cause: error },
    );
  }

  if (!response.ok)
    throw new UserFacingError(
      {
        title: 'ip-api.com is unavailable',
        description:
          'ip-api.com returned an error and may be temporarily down. Please try again shortly.',
        retryable: true,
      },
      {
        cause: new Error(
          `ip-api.com responded with HTTP ${response.status} ${response.statusText}`,
        ),
      },
    );

  const data = (await response.json()) as Record<string, any>;
  delete data.status;

  return data as IpDetails;
};

export const ipv4ToDnsName = (ipv4: string) =>
  ipv4.split('.').reverse().join('.') + '.in-addr.arpa';

export const ipv6ToDnsName = (ipv6: string) => {
  const [head, tail] = ipv6.includes('::') ? ipv6.split('::') : [ipv6, ''];
  const headSegments = head ? head.split(':') : [];
  const tailSegments = tail ? tail.split(':') : [];
  const missingSegments = 8 - headSegments.length - tailSegments.length;
  const expandedSegments = [
    ...headSegments,
    ...Array<string>(missingSegments).fill('0'),
    ...tailSegments,
  ].map((segment) => segment.padStart(4, '0'));
  const fullAddress = expandedSegments.join('');

  return fullAddress.split('').reverse().join('.') + '.ip6.arpa';
};

export const ipToDnsName = (ip: string) =>
  ip.includes(':') ? ipv6ToDnsName(ip) : ipv4ToDnsName(ip);

export const lookupReverse = async (ip: string): Promise<string[]> => {
  if (!isIP(ip)) {
    throw new UserFacingError({
      title: 'Invalid IP address',
      description: 'The provided IP address is not valid.',
    });
  }

  const reverseDnsName = ipToDnsName(ip);

  let response: Response;
  try {
    response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(reverseDnsName)}&type=PTR`,
      {
        headers: { Accept: 'application/dns-json' },
      },
    );
  } catch (error) {
    throw new UserFacingError(
      {
        title: "Couldn't reach Cloudflare DNS",
        description:
          "We couldn't complete the request to Cloudflare DNS. Please try again shortly.",
        retryable: true,
      },
      { cause: error },
    );
  }

  if (!response.ok)
    throw new UserFacingError(
      {
        title: 'Cloudflare DNS is unavailable',
        description:
          'Cloudflare DNS returned an error and may be temporarily down. Please try again shortly.',
        retryable: true,
      },
      {
        cause: new Error(
          `Cloudflare DNS responded with HTTP ${response.status} ${response.statusText}`,
        ),
      },
    );

  const data = await response.json();

  return data.Answer
    ? data.Answer.map((record: { data: string }) => record.data.slice(0, -1))
    : [];
};

// Standardize last segment of IP address to reduce the number of requests and avoid rate limiting
// 1st Regex is for IPv4
// 2nd & 3rd Regexes are for IPv6 (3rd canonicalizes a trailing "::" to "::0")
export const normalizeIpEnding = (ip: string) =>
  ip
    .replace(/\.[0-9]+$/, '.0')
    .replace(/:([0-9a-fA-F]+)$/, ':0')
    .replace(/::$/, '::0');

export const hostLookupLoader = new DataLoader(
  async (keys: readonly string[]) =>
    Promise.all(
      keys.map(async (ip) => {
        const normalIp = normalizeIpEnding(ip);
        const data = await getIpDetails(normalIp);

        if (data.org === data.isp) {
          return [data.org];
        }

        return [data.org, data.isp].filter(Boolean);
      }),
    ),
  {
    cacheKeyFn: normalizeIpEnding,
  },
);
