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

import CloudflareDoHResolver from '@/lib/resolvers/CloudflareDoHResolver';
import { findSubdomains } from '@/lib/subdomains';

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
  const { results, isTruncated, RESULTS_LIMIT } = await findSubdomains(
    domain,
    new CloudflareDoHResolver()
  );

  if (!results.length) {
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
          {results.map((result) => (
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

      {isTruncated && (
        <p className="mt-8 text-center text-muted-foreground">
          Results limited to {RESULTS_LIMIT} subdomains.
        </p>
      )}
    </>
  );
};

export default SubdomainsResultsPage;
