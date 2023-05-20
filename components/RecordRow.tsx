'use client';

import { ExternalLinkIcon, InfoIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactNodeArray, useState } from 'react';
import reactStringReplace from 'react-string-replace';
import { useDisclosure } from 'react-use-disclosure';
import isIP from 'validator/lib/isIP';

import { TableCell, TableRow } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import IpDetailsModal from '@/components/IpDetailsModal';
import { RawRecord } from '@/utils/DnsLookup';

const domainRegex =
  /(_)*(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g;

const RecordRow = ({ record }: { record: RawRecord }) => {
  const [detailedIp, setDetailedIp] = useState<string | null>(null);
  const { isOpen, open, close } = useDisclosure();

  let interpolatedValue: ReactNodeArray | string | null = record.data;

  const domainMatches = record.data.match(domainRegex);
  if (domainMatches) {
    for (const domain of domainMatches) {
      interpolatedValue = reactStringReplace(
        interpolatedValue,
        domain,
        (match) => {
          if (isIP(match)) {
            return (
              <>
                <span>{match}</span>{' '}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon
                        role="button"
                        className="mx-1 inline-block h-3 w-3 -translate-y-0.5 cursor-pointer"
                        onClick={() => {
                          setDetailedIp(match);
                          open();
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View IP Info</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            );
          }

          return (
            <>
              <span>{match}</span>{' '}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Link href={`/lookup/${match}`}>
                      <ExternalLinkIcon className="mx-1 inline-block h-3 w-3 -translate-y-0.5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Domain Records</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          );
        }
      );
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="pl-0">{record.name}</TableCell>
        <TableCell>{record.TTL}</TableCell>
        <TableCell className="pr-0">{interpolatedValue}</TableCell>
      </TableRow>

      <IpDetailsModal ip={detailedIp!} isOpen={isOpen} onClose={close} />
    </>
  );
};

export default RecordRow;
