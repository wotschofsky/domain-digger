import type { Metadata } from 'next';
import { redirect, RedirectType } from 'next/navigation';
import type { FC } from 'react';

import DnsTable from '@/components/results/dns/DnsTable';
import LocationSelector from '@/components/results/dns/LocationSelector';
import ResolverSelector from '@/components/results/dns/ResolverSelector';
import { hostLookupLoader } from '@/lib/ips';
import AuthoritativeResolver from '@/lib/resolvers/AuthoritativeResolver';
import CloudflareDoHResolver from '@/lib/resolvers/CloudflareDoHResolver';
import GoogleDoHResolver from '@/lib/resolvers/GoogleDoHResolver';
import InternalDoHResolver from '@/lib/resolvers/InternalDoHResolver';

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

const getIpsInfo = async (ips: string[]): Promise<Record<string, string>> => {
  const hosts = await hostLookupLoader.loadMany(ips);
  return Object.fromEntries(
    ips
      .map((ip, index) => [ip, hosts[index]])
      .filter(([, host]) => typeof host === 'string')
  );
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
  const ipsInfo = await getIpsInfo(
    records.A.map((r) => r.data).concat(records.AAAA.map((r) => r.data))
  );

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
        <DnsTable records={records} ipsInfo={ipsInfo} />
      ) : (
        <p className="mt-24 text-center text-muted-foreground">
          No DNS records found!
        </p>
      )}
    </>
  );
};

export default LookupDomain;
