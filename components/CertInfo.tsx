'use client';

import { ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import type { FC } from 'react';
import useSWR from 'swr';

import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { CertLookupResponse } from '@/app/api/lookupCerts/route';

type CertInfoProps = {
  domain: string;
};

const CertInfo: FC<CertInfoProps> = ({ domain }) => {
  const { data, error } = useSWR<CertLookupResponse>(
    `/api/lookupCerts?domain=${encodeURIComponent(domain)}`
  );

  if (!data) {
    return (
      <div className="flex items-center justify-center">
        <Spinner className="my-8" />
      </div>
    );
  }

  if (error) {
    return <p>An error occurred!</p>;
  }

  if (!data.certificates.length) {
    return (
      <p className="mt-8 text-center text-muted-foreground">
        No issued certificates found!
      </p>
    );
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHead className="pl-0">Logged At</TableHead>
          <TableHead>Not Before</TableHead>
          <TableHead>Not After</TableHead>
          <TableHead>Common Name</TableHead>
          <TableHead>Matching Identities</TableHead>
          <TableHead className="pr-0">Issuer Name</TableHead>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.certificates.map((cert) => (
          <TableRow key={cert.id}>
            <TableCell className="pl-0">{cert.loggedAt}</TableCell>
            <TableCell>{cert.notBefore}</TableCell>
            <TableCell>{cert.notAfter}</TableCell>
            <TableCell>
              <>
                <span>{cert.commonName}</span>{' '}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Link href={`/lookup/${cert.commonName}`}>
                        <ExternalLinkIcon className="mx-1 inline-block h-3 w-3 -translate-y-0.5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Domain Records</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            </TableCell>
            <TableCell>
              {cert.matchingIdentities.split(/\n/g).map((value, index) => (
                <>
                  {index !== 0 && <br />}
                  <span>{value}</span>{' '}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Link href={`/lookup/${value}`}>
                          <ExternalLinkIcon className="mx-1 inline-block h-3 w-3 -translate-y-0.5" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View Domain Records</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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

export default CertInfo;
