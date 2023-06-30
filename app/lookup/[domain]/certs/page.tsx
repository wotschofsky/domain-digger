import { ExternalLinkIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import DomainLink from '@/components/DomainLink';

const lookupCerts = async (domain: string) => {
  const response = await fetch(
    'https://crt.sh?' +
      new URLSearchParams({
        Identity: domain,
        output: 'json',
      })
  );

  if (!response.ok) {
    throw new Error('Failed to fetch certs');
  }

  const data = (await response.json()) as {
    issuer_ca_id: number;
    issuer_name: string;
    common_name: string;
    name_value: string;
    id: number;
    entry_timestamp: string;
    not_before: string;
    not_after: string;
    serial_number: string;
  }[];

  return data.map((c) => ({
    id: c.id,
    loggedAt: c.entry_timestamp,
    notBefore: c.not_before,
    notAfter: c.not_after,
    commonName: c.common_name,
    matchingIdentities: c.name_value,
    issuerName: c.issuer_name,
  }));
};

type CertsResultsPageProps = {
  params: { domain: string };
};

export const runtime = 'edge';
// crt.sh located in GB, always use LHR1 for lowest latency
export const preferredRegion = 'lhr1';

const CertsResultsPage = async ({
  params: { domain },
}: CertsResultsPageProps) => {
  const certs = await lookupCerts(domain);

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
        <TableRow>
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
          <TableRow key={cert.id}>
            <TableCell className="pl-0">{cert.loggedAt}</TableCell>
            <TableCell>{cert.notBefore}</TableCell>
            <TableCell>{cert.notAfter}</TableCell>
            <TableCell>
              <DomainLink domain={cert.commonName} />
            </TableCell>

            <TableCell>
              {cert.matchingIdentities.split(/\n/g).map((value, index) => (
                <>
                  {index !== 0 && <br />}
                  <DomainLink domain={value} />
                </>
              ))}
            </TableCell>
            <TableCell className="pr-0">{cert.issuerName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default CertsResultsPage;
