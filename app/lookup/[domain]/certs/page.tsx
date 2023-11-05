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

type CertsData = {
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

const lookupCerts = async (domain: string): Promise<CertsData> => {
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

  return await response.json();
};

type CertsResultsPageProps = {
  params: {
    domain: string;
  };
};

const CertsResultsPage: FC<CertsResultsPageProps> = async ({
  params: { domain },
}) => {
  const certRequests = [lookupCerts(domain)];

  const hasParentDomain = domain.split('.').filter(Boolean).length > 2;
  if (hasParentDomain) {
    const parentDomain = domain.split('.').slice(1).join('.');
    certRequests.push(lookupCerts(`*.${parentDomain}`));
  }

  const certs = await Promise.all(certRequests).then((responses) =>
    responses
      .flat()
      .sort(
        (a, b) =>
          new Date(b.entry_timestamp).getTime() -
          new Date(a.entry_timestamp).getTime()
      )
  );

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
              <DomainLink domain={cert.common_name} />
            </TableCell>

            <TableCell>
              {cert.name_value.split(/\n/g).map((value, index) => (
                <>
                  {index !== 0 && <br />}
                  <DomainLink domain={value} />
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
