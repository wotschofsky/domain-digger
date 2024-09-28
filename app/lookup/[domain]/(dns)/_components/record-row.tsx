import ms from 'ms';
import type { FC, ReactNode } from 'react';
import reactStringReplace from 'react-string-replace';

import { TableCell, TableRow } from '@/components/ui/table';

import type { RecordContextEntry } from '@/lib/record-context';
import { cn, DOMAIN_REGEX, IPV4_REGEX, IPV6_REGEX } from '@/lib/utils';

import { DomainLink } from '../../_components/domain-link';
import { IpLink } from '../../_components/ip-link';
import { RecordSubvalues } from './record-subvalues';

type RecordRowProps = {
  name: string;
  TTL: number;
  value: string;
  subvalues?: RecordContextEntry[];
};

export const RecordRow: FC<RecordRowProps> = ({
  name,
  TTL,
  value,
  subvalues,
}) => {
  let interpolatedValue: ReactNode[] | string | null = value;

  const domainMatches = value.match(DOMAIN_REGEX);
  for (const domain of domainMatches ?? []) {
    interpolatedValue = reactStringReplace(
      interpolatedValue,
      domain,
      (match) => {
        const normalizedMatch = match.endsWith('.')
          ? match.slice(0, -1)
          : match;
        return <DomainLink domain={normalizedMatch} />;
      },
    );
  }

  const ipv4Matches = value.match(IPV4_REGEX);
  for (const domain of ipv4Matches ?? []) {
    interpolatedValue = reactStringReplace(
      interpolatedValue,
      domain,
      (match) => <IpLink value={match} />,
    );
  }

  const ipv6Matches = value.match(IPV6_REGEX);
  for (const domain of ipv6Matches ?? []) {
    interpolatedValue = reactStringReplace(
      interpolatedValue,
      domain,
      (match) => <IpLink value={match} />,
    );
  }

  return (
    <TableRow className="whitespace-nowrap hover:bg-transparent">
      <TableCell className="w-0 min-w-[20%] pl-0 pr-12">{name}</TableCell>
      <TableCell className="w-32 py-1 pr-12">
        {TTL}
        <RecordSubvalues
          subvalues={[{ description: ms(TTL * 1000, { long: true }) }]}
        />
      </TableCell>
      <TableCell
        className={cn(
          'whitespace-normal break-words pr-0',
          subvalues ? 'py-1' : 'py-4',
        )}
      >
        {interpolatedValue}
        {subvalues && <RecordSubvalues subvalues={subvalues} />}
      </TableCell>
    </TableRow>
  );
};
