import { CheckIcon, XIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { FC } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { lookupCerts } from '@/lib/certs';
import CloudflareDoHResolver from '@/lib/resolvers/CloudflareDoHResolver';
import { isValidDomain } from '@/lib/utils';

import DomainLink from '../_components/DomainLink';

export const runtime = 'edge';
// crt.sh located in GB, always use LHR1 for lowest latency
export const preferredRegion = 'lhr1';

type SubdomainsResultsPageProps = {
  params: {
    domain: string;
  };
};

export const generateMetadata = ({
  params: { domain },
}: SubdomainsResultsPageProps): Metadata => ({
  openGraph: {
    url: `/lookup/${domain}/subdomains`,
  },
  alternates: {
    canonical: `/lookup/${domain}/subdomains`,
  },
});

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
  )
    .filter(isValidDomain)
    .filter((d) => d.endsWith(`.${domain}`));

  const results = await Promise.all(
    // Limited to avoid subrequest limit from Cloudflare Workers of 1000
    // https://developers.cloudflare.com/workers/platform/limits#subrequests
    uniqueDomains.slice(0, 500).map(async (domain) => {
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
    <>
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

      {uniqueDomains.length > 500 && (
        <p className="mt-8 text-center text-muted-foreground">
          Results limited to 500 subdomains.
        </p>
      )}
    </>
  );
};

export default SubdomainsResultsPage;
