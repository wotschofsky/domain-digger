import type { Metadata } from 'next';
import { redirect, RedirectType } from 'next/navigation';
import type { FC } from 'react';

import { getRecordContextEntries } from '@/lib/record-context';
import { ALL_RECORD_TYPES } from '@/lib/resolvers/base';
import { getResolverFromName } from '@/lib/resolvers/utils';

import { DnsTable } from './_components/dns-table';
import { LocationSelector } from './_components/location-selector';
import { ResolverSelector } from './_components/resolver-selector';

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

  const resolver = getResolverFromName(resolverName, locationName);
  const records = await resolver.resolveRecordTypes(domain, ALL_RECORD_TYPES);
  const subvalues = await getRecordContextEntries(records);

  const hasResults =
    Object.values(records).reduce(
      (prev, curr) => prev + curr.records.length,
      0
    ) > 0;

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
