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

import { lookupRelatedCerts } from '@/lib/certs';
import { isValidDomain } from '@/lib/utils';

import { DomainLink } from '../_components/domain-link';

export const runtime = 'edge';
// crt.sh located in GB, always use LHR1 for lowest latency
export const preferredRegion = 'lhr1';

type CertsResultsPageProps = {
  params: {
    domain: string;
  };
};

export const generateMetadata = ({
  params: { domain },
}: CertsResultsPageProps): Metadata => ({
  openGraph: {
    url: `/lookup/${domain}/certs`,
  },
  alternates: {
    canonical: `/lookup/${domain}/certs`,
  },
});

const CertsResultsPage: FC<CertsResultsPageProps> = async ({
  params: { domain },
}) => {
  const certs = await lookupRelatedCerts(domain);

  if (!certs.length) {
    return (
      <p className="mt-8 text-center text-muted-foreground">
        No issued certificates found!
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-0">Logged At</TableHead>
          <TableHead>Not Before</TableHead>
          <TableHead>Not After</TableHead>
          <TableHead>Common Name</TableHead>
          <TableHead>Matching Identities</TableHead>
          <TableHead className="pr-0">Issuer Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {certs.map((cert) => (
          <TableRow key={cert.id} className="hover:bg-transparent">
            <TableCell className="pl-0">{cert.entry_timestamp}</TableCell>
            <TableCell>{cert.not_before}</TableCell>
            <TableCell>{cert.not_after}</TableCell>
            <TableCell>
              {isValidDomain(cert.common_name) ? (
                <DomainLink domain={cert.common_name} />
              ) : (
                <span>{cert.common_name}</span>
              )}
            </TableCell>

            <TableCell>
              {cert.name_value.split(/\n/g).map((value, index) => (
                <>
                  {index !== 0 && <br />}
                  {isValidDomain(value) ? (
                    <DomainLink domain={value} />
                  ) : (
                    <span>{value}</span>
                  )}
                </>
              ))}
            </TableCell>
            <TableCell className="pr-0">{cert.issuer_name}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default CertsResultsPage;
