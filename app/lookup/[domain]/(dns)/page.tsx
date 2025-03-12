import type { Metadata } from 'next';
import { notFound, redirect, RedirectType } from 'next/navigation';
import type { FC } from 'react';

import { ALL_RECORD_TYPES } from '@/lib/data';
import { getRecordContextEntries } from '@/lib/record-context';
import { getResolverFromName } from '@/lib/resolvers/utils';

import { DnsTable } from './_components/dns-table';

type LookupDomainProps = {
  params: Promise<{
    domain: string;
  }>;
  searchParams: Promise<{
    resolver?: string;
    location?: string;
  }>;
};

export const generateMetadata = async ({
  params,
  searchParams,
}: LookupDomainProps): Promise<Metadata> => {
  const { domain } = await params;
  const { resolver, location } = await searchParams;

  const normalizedParams = new URLSearchParams();
  if (resolver) normalizedParams.set('resolver', resolver);
  if (location) normalizedParams.set('location', location);
  const suffix = normalizedParams.size ? `?${normalizedParams.toString()}` : '';

  return {
    title: `DNS Lookup for ${domain}`,
    openGraph: {
      title: `DNS Lookup for ${domain}`,
      url: `/lookup/${domain}${suffix}`,
    },
    alternates: {
      canonical: `/lookup/${domain}${suffix}`,
    },
  };
};

export const fetchCache = 'default-no-store';

const LookupDomain: FC<LookupDomainProps> = async ({
  params,
  searchParams,
}) => {
  const { domain } = await params;
  const { resolver: resolverName, location: locationName } = await searchParams;

  if (locationName && !resolverName) {
    return redirect(
      `/lookup/${encodeURIComponent(domain)}`,
      RedirectType.replace,
    );
  }

  const resolver = getResolverFromName(resolverName, locationName);
  const records = await resolver.resolveRecordTypes(domain, ALL_RECORD_TYPES);
  const subvalues = await getRecordContextEntries(records);

  const hasResults =
    Object.values(records).reduce(
      (prev, curr) => prev + curr.records.length,
      0,
    ) > 0;

  if (hasResults) {
    return <DnsTable records={records} subvalues={subvalues} />;
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <p className="text-zinc-500 dark:text-zinc-400">No DNS records found!</p>
    </div>
  );
};

export default LookupDomain;
