import { CheckIcon, XIcon } from 'lucide-react';
import type { FC } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import DomainLink from '@/components/DomainLink';
import { lookupCerts } from '@/lib/certs';
import CloudflareDoHResolver from '@/lib/resolvers/CloudflareDoHResolver';

export const runtime = 'edge';
// crt.sh located in GB, always use LHR1 for lowest latency
export const preferredRegion = 'lhr1';

type SubdomainsResultsPageProps = {
  params: {
    domain: string;
  };
};

const SubdomainsResultsPage: FC<SubdomainsResultsPageProps> = async ({
  params: { domain },
}) => {
  const resolver = new CloudflareDoHResolver();

  const certs = await lookupCerts(domain);

  const issuedCerts = certs.map((cert) => ({
    date: new Date(cert.entry_timestamp),
    domains: [cert.common_name, ...cert.name_value.split(/\n/g)],
  }));

  const uniqueDomains = Array.from(
    new Set<string>(issuedCerts.flatMap((r) => r.domains))
  ).filter((d) => d.endsWith(`.${domain}`));

  const results = await Promise.all(
    uniqueDomains.map(async (domain, i) => {
      const records = await resolver.resolveRecordType(domain, 'A');
      const hasRecords = records.length > 0;

      return {
        domain,
        firstSeen: issuedCerts
          .filter((c) => c.domains.includes(domain))
          .sort((a, b) => a.date.getTime() - b.date.getTime())[0].date,
        stillExists: hasRecords,
      };
    })
  );
  const sortedResults = results.sort(
    (a, b) => b.firstSeen.getTime() - a.firstSeen.getTime()
  );

  if (!sortedResults.length) {
    return (
      <p className="mt-8 text-center text-muted-foreground">
        Could not find any subdomains for this domain.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-0">Domain Name</TableHead>
          <TableHead>First seen</TableHead>
          <TableHead className="pr-0">Still exists</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedResults.map((result) => (
          <TableRow key={result.domain} className="hover:bg-transparent">
            <TableCell className="pl-0">
              <DomainLink domain={result.domain} />
            </TableCell>
            <TableCell>{result.firstSeen.toISOString()}</TableCell>
            <TableCell className="pr-0">
              {result.stillExists ? (
                <CheckIcon size="1.25rem" />
              ) : (
                <XIcon size="1.25rem" />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default SubdomainsResultsPage;
