import type { FC } from 'react';

import DnsTable from '@/components/DnsTable';
import DomainNotRegistered from '@/components/DomainNotRegistered';
import { isAvailable } from '@/lib/whois';
import DnsLookup from '@/utils/DnsLookup';

type LookupDomainProps = {
  params: {
    domain: string;
  };
};

export const fetchCache = 'default-no-store';

const LookupDomain: FC<LookupDomainProps> = async ({ params: { domain } }) => {
  const records = await DnsLookup.resolveAllRecords(domain);

  if ((await isAvailable(domain)) != 'registered') {
    return <DomainNotRegistered />;
  }

  return (
    <>
      {Object.values(records)
        .map((r) => r.length)
        .reduce((prev, curr) => prev + curr, 0) === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">
          No DNS records found!
        </p>
      ) : (
        <DnsTable records={records} />
      )}
    </>
  );
};

export default LookupDomain;
