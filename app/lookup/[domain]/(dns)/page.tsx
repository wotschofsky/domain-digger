import type { Metadata } from 'next';
import { notFound, redirect, RedirectType } from 'next/navigation';
import type { FC } from 'react';

import { ALL_RECORD_TYPES } from '@/lib/data';
import { getRecordContextEntries } from '@/lib/record-context';
import { getResolverFromName } from '@/lib/resolvers/utils';

import { DnsTable } from './_components/dns-table';

type DnsResultsPageProps = {
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
}: DnsResultsPageProps): Promise<Metadata> => {
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

const DnsResultsPage: FC<DnsResultsPageProps> = async ({
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

  if (!hasResults) {
    notFound();
  }

  return <DnsTable records={records} subvalues={subvalues} />;
};

export default DnsResultsPage;
