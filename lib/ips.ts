import DataLoader from 'dataloader';

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
  const response = await fetch(`http://ip-api.com/json/${ip}`);

  if (!response.ok)
    throw new Error(`Error fetching IP details: ${response.statusText}`);

  const data = (await response.json()) as Record<string, any>;
  delete data.status;

  return data as IpDetails;
};

export const ipv4ToDnsName = (ipv4: string) =>
  ipv4.split('.').reverse().join('.') + '.in-addr.arpa';

export const ipv6ToDnsName = (ipv6: string) => {
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

export const ipToDnsName = (ip: string) =>
  ip.includes(':') ? ipv6ToDnsName(ip) : ipv4ToDnsName(ip);

export const lookupReverse = async (ip: string): Promise<string[]> => {
  const reverseDnsName = ipToDnsName(ip);

  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${reverseDnsName}&type=PTR`,
    {
      headers: { Accept: 'application/dns-json' },
    },
  );

  if (!response.ok)
    throw new Error(`Error fetching DNS records: ${response.statusText}`);

  const data = await response.json();

  return data.Answer
    ? data.Answer.map((record: { data: string }) => record.data.slice(0, -1))
    : [];
};

// Standardize last segment of IP address to reduce the number of requests and avoid rate limiting
// 1st Regex is for IPv4
// 2nd Regex is for IPv6
export const normalizeIpEnding = (ip: string) =>
  ip.replace(/\.[0-9]+$/, '.0').replace(/:([0-9a-fA-F]+)$/, ':');

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
