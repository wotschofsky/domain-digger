import type { FC } from 'react';

import DnsTable from '@/components/DnsTable';
import ResolverSelector from '@/components/ResolverSelector';
import AuthoritativeResolver from '@/lib/resolvers/AuthoritativeResolver';
import CloudflareDoHResolver from '@/lib/resolvers/CloudflareDoHResolver';
import GoogleDoHResolver from '@/lib/resolvers/GoogleDoHResolver';

const getResolver = (resolverName: string | undefined) => {
  switch (resolverName) {
    case 'cloudflare':
      return CloudflareDoHResolver;
    case 'google':
      return GoogleDoHResolver;
    default:
      return AuthoritativeResolver;
  }
};

type LookupDomainProps = {
  params: {
    domain: string;
  };
  searchParams: {
    resolver?: string;
  };
};

export const fetchCache = 'default-no-store';

const LookupDomain: FC<LookupDomainProps> = async ({
  params: { domain },
  searchParams: { resolver: resolverName },
}) => {
  const Resolver = getResolver(resolverName);

  const lookup = new Resolver();
  const records = await lookup.resolveAllRecords(domain);

  const hasResults =
    Object.values(records)
      .map((r) => r.length)
      .reduce((prev, curr) => prev + curr, 0) > 0;

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Resolver</span>
        <ResolverSelector initialValue={resolverName} />
      </div>

      {hasResults ? (
        <DnsTable records={records} />
      ) : (
        <p className="mt-24 text-center text-muted-foreground">
          No DNS records found!
        </p>
      )}
    </>
  );
};

export default LookupDomain;
