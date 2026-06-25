import type { FC } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { DnssecChain, DnssecStatus, DnssecZone } from '@/lib/dnssec';
import { cn } from '@/lib/utils';

// Mirrors the DNS tab's visual language: a plain-language lead, then one
// <h2> section per zone (root -> queried domain) with the zone's keys in the
// shared Table. The chain reads top-down; a sentence per zone explains the
// link to its parent. See lib/dnssec.ts for what the verdict does/doesn't cover.

const STATUS_DOT: Record<DnssecStatus, string> = {
  secure: 'bg-emerald-500',
  insecure: 'bg-zinc-400',
  broken: 'bg-red-500',
};

const STATUS_LABEL: Record<DnssecStatus, string> = {
  secure: 'Secure',
  insecure: 'Insecure',
  broken: 'Broken',
};

const VERDICT_TITLE: Record<DnssecStatus, string> = {
  secure: 'Chain of trust verified',
  insecure: 'Not protected by DNSSEC',
  broken: 'Chain of trust is broken',
};

const VERDICT_DESCRIPTION: Record<DnssecStatus, string> = {
  secure:
    'Every zone from the root down to this domain is signed and correctly linked to its parent, so its DNS records can be cryptographically authenticated.',
  insecure:
    'No signed delegation was found for this domain, so its DNS records cannot be cryptographically authenticated.',
  broken:
    'A zone in the chain publishes a DS record that does not match the keys it serves, so validation fails and the domain may be unreachable for validating resolvers.',
};

const StatusDot: FC<{ status: DnssecStatus; className?: string }> = ({
  status,
  className,
}) => (
  <span
    className={cn('inline-block rounded-full', STATUS_DOT[status], className)}
  />
);

/** Plain-language explanation of how a zone is (or isn't) linked to its parent. */
const linkSummary = (zone: DnssecZone): string => {
  if (zone.name === '.') {
    const anchor = zone.dsRecords[0];
    return `Anchored to the IANA root trust anchor${
      anchor ? ` (key tag ${anchor.keyTag})` : ''
    }.`;
  }

  const matched = zone.dsRecords.find((ds) => ds.matched);
  if (matched) {
    return zone.status === 'secure'
      ? `Authenticated by a DS record in the parent zone (key tag ${matched.keyTag}).`
      : `Linked by a DS record (key tag ${matched.keyTag}), but the chain is already broken higher up.`;
  }

  if (zone.dsRecords.length) {
    const ds = zone.dsRecords[0];
    return zone.keys.length
      ? `The parent zone's DS record (key tag ${ds.keyTag}) matches none of this zone's keys.`
      : `The parent zone vouches for this zone (DS key tag ${ds.keyTag}) but it serves no DNSKEY.`;
  }

  return 'No DS record in the parent zone — the chain of trust ends here.';
};

const ZoneSection: FC<{ zone: DnssecZone }> = ({ zone }) => {
  const heading = zone.name === '.' ? 'Root zone' : zone.displayName;

  return (
    <section>
      <div className="mt-12 mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {heading}
        </h2>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <StatusDot status={zone.status} className="size-2" />
          {STATUS_LABEL[zone.status]}
        </span>
      </div>

      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        {linkSummary(zone)}
      </p>

      {zone.keys.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Key Tag</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Algorithm</TableHead>
              <TableHead className="pr-0">Parent DS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zone.keys.map((key) => (
              <TableRow key={key.keyTag} className="hover:bg-transparent">
                <TableCell className="pl-0 font-mono">{key.keyTag}</TableCell>
                <TableCell>
                  {key.isSep ? 'KSK' : 'ZSK'}
                  {key.isRevoked && (
                    <span className="text-red-600 dark:text-red-400">
                      {' '}
                      (revoked)
                    </span>
                  )}
                </TableCell>
                <TableCell>{key.algorithmName}</TableCell>
                <TableCell className="pr-0">
                  {key.linked ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Matches
                    </span>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-zinc-500 italic dark:text-zinc-400">
          This zone publishes no DNSKEY.
        </p>
      )}
    </section>
  );
};

type ChainDiagramProps = {
  chain: DnssecChain;
};

export const ChainDiagram: FC<ChainDiagramProps> = ({ chain }) => (
  <div>
    <div className="flex items-center gap-2.5">
      <StatusDot status={chain.overall} className="size-2.5" />
      <p className="text-lg font-semibold tracking-tight">
        {VERDICT_TITLE[chain.overall]}
      </p>
    </div>
    <p className="mt-1.5 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
      {VERDICT_DESCRIPTION[chain.overall]}
    </p>

    {chain.zones.map((zone) => (
      <ZoneSection key={zone.name} zone={zone} />
    ))}
  </div>
);
