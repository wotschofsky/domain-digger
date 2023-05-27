'use client';

import { ExternalLinkIcon, InfoIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactNodeArray, useState } from 'react';
import reactStringReplace from 'react-string-replace';
import { useDisclosure } from 'react-use-disclosure';

import { TableCell, TableRow } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import IpDetailsModal from '@/components/IpDetailsModal';
import { RawRecord } from '@/utils/DnsLookup';

const DOMAIN_REGEX = /([a-zA-Z0-9-_]+\.)+[a-z]+.?/gi;
const IPV4_REGEX = /(\d{1,3}\.){3}\d{1,3}/g;
const IPV6_REGEX =
  /((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?/gi;

const RecordRow = ({ record }: { record: RawRecord }) => {
  const [detailedIp, setDetailedIp] = useState<string | null>(null);
  const { isOpen, open, close } = useDisclosure();

  let interpolatedValue: ReactNodeArray | string | null = record.data;

  const domainMatches = record.data.match(DOMAIN_REGEX);
  for (const domain of domainMatches ?? []) {
    interpolatedValue = reactStringReplace(
      interpolatedValue,
      domain,
      (match) => {
        const normalizedMatch = match.endsWith('.')
          ? match.slice(0, -1)
          : match;
        return (
          <>
            <span>{match}</span>{' '}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Link href={`/lookup/${normalizedMatch}`}>
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

  const ipv4Matches = record.data.match(IPV4_REGEX);
  for (const domain of ipv4Matches ?? []) {
    interpolatedValue = reactStringReplace(
      interpolatedValue,
      domain,
      (match) => {
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
    );
  }

  const ipv6Matches = record.data.match(IPV6_REGEX);
  console.log(ipv6Matches);
  for (const domain of ipv6Matches ?? []) {
    interpolatedValue = reactStringReplace(
      interpolatedValue,
      domain,
      (match) => {
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
    );
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
