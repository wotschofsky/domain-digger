import type { Metadata } from 'next';
import { redirect, RedirectType } from 'next/navigation';
import type { FC } from 'react';

import { RECORD_INSIGHTS } from '@/lib/data';
import { hostLookupLoader } from '@/lib/ips';
import { AuthoritativeResolver } from '@/lib/resolvers/authoritative';
import type { ResolvedRecords } from '@/lib/resolvers/base';
import { CloudflareDoHResolver } from '@/lib/resolvers/cloudflare';
import { GoogleDoHResolver } from '@/lib/resolvers/google';
import { InternalDoHResolver } from '@/lib/resolvers/internal';

import { DnsTable } from './_components/dns-table';
import { LocationSelector } from './_components/location-selector';
import type { SubvalueInfo } from './_components/record-subvalues';
import { ResolverSelector } from './_components/resolver-selector';

const getResolver = (
  resolverName: string | undefined,
  locationName: string | undefined
) => {
  if (locationName) {
    switch (resolverName) {
      case 'cloudflare':
        return new InternalDoHResolver(locationName, 'cloudflare');
      case 'google':
        return new InternalDoHResolver(locationName, 'google');
    }

    throw new Error('Invalid resolver');
  }

  switch (resolverName) {
    case 'cloudflare':
      return new CloudflareDoHResolver();
    case 'google':
      return new GoogleDoHResolver();
    default:
      return new AuthoritativeResolver();
  }
};

const getIpsInfo = async (ips: string[]): Promise<Record<string, string[]>> => {
  const hosts = await hostLookupLoader.loadMany(ips);
  return Object.fromEntries(
    ips
      .map((ip, index) => [ip, hosts[index]])
      .filter(([, hosts]) => Array.isArray(hosts))
  );
};

const getSubvalues = async (records: ResolvedRecords) => {
  const allSubvalues: Record<string, SubvalueInfo[]> = {};

  const ips = records.A.map((r) => r.data).concat(
    records.AAAA.map((r) => r.data)
  );
  const ipsInfo = await getIpsInfo(ips);

  const flatRecords = Object.values(records).flat();
  for (const record of flatRecords) {
    const subvalues: SubvalueInfo[] = [];

    const normalizedRecord = record.data.endsWith('.')
      ? record.data.slice(0, -1)
      : record.data;

    const possibleInsights = RECORD_INSIGHTS[record.type];
    for (const insight of possibleInsights) {
      if (insight.test.test(normalizedRecord)) {
        subvalues.push(insight);
      }
    }

    if (record.data in ipsInfo) {
      subvalues.push(
        ...ipsInfo[record.data].map((h) => ({
          description: h,
        }))
      );
    }

    if (subvalues.length > 0) {
      allSubvalues[record.data] = subvalues;
    }
  }

  return allSubvalues;
};

type LookupDomainProps = {
  params: {
    domain: string;
  };
  searchParams: {
    resolver?: string;
    location?: string;
  };
};

export const generateMetadata = ({
  params: { domain },
  searchParams: { resolver, location },
}: LookupDomainProps): Metadata => {
  const params = new URLSearchParams();
  if (resolver) params.set('resolver', resolver);
  if (location) params.set('location', location);
  const search = params.size ? `?${params.toString()}` : '';

  return {
    openGraph: {
      url: `/lookup/${domain}${search}`,
    },
    alternates: {
      canonical: `/lookup/${domain}${search}`,
    },
  };
};

export const fetchCache = 'default-no-store';

const LookupDomain: FC<LookupDomainProps> = async ({
  params: { domain },
  searchParams: { resolver: resolverName, location: locationName },
}) => {
  if (locationName && !resolverName) {
    return redirect(
      `/lookup/${encodeURIComponent(domain)}`,
      RedirectType.replace
    );
  }

  const resolver = getResolver(resolverName, locationName);
  const records = await resolver.resolveAllRecords(domain);
  const subvalues = await getSubvalues(records);

  const hasResults =
    Object.values(records)
      .map((r) => r.length)
      .reduce((prev, curr) => prev + curr, 0) > 0;

  return (
    <>
      <div className="flex flex-col gap-8 sm:flex-row">
        <ResolverSelector initialValue={resolverName} />
        <LocationSelector
          initialValue={locationName}
          disabled={!resolverName}
        />
      </div>

      {hasResults ? (
        <DnsTable records={records} subvalues={subvalues} />
      ) : (
        <p className="mt-24 text-center text-muted-foreground">
          No DNS records found!
        </p>
      )}
    </>
  );
};

export default LookupDomain;
