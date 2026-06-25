import {
  ArrowDownIcon,
  CheckIcon,
  KeyRoundIcon,
  LinkIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  XIcon,
} from 'lucide-react';
import type { FC } from 'react';

import type { DnssecChain, DnssecStatus, DnssecZone } from '@/lib/dnssec';
import { cn } from '@/lib/utils';

// ponytail: icon-arrow + card layout, not a positioned SVG DAG. The chain is
// effectively linear (one zone per row), so this faithfully mirrors DNSViz's
// authentication chain without a graph library. Upgrade to SVG only if a
// richer, edge-crossing graph is ever needed.

const STATUS_STYLES: Record<
  DnssecStatus,
  {
    label: string;
    Icon: typeof ShieldCheckIcon;
    text: string;
    badge: string;
    border: string;
    arrow: string;
  }
> = {
  secure: {
    label: 'Secure',
    Icon: ShieldCheckIcon,
    text: 'text-emerald-700 dark:text-emerald-400',
    badge:
      'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-400/20',
    border: 'border-emerald-300 dark:border-emerald-800',
    arrow: 'text-emerald-500',
  },
  insecure: {
    label: 'Insecure',
    Icon: ShieldAlertIcon,
    text: 'text-amber-700 dark:text-amber-400',
    badge:
      'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-400 dark:ring-amber-400/20',
    border: 'border-amber-300 dark:border-amber-800',
    arrow: 'text-amber-500',
  },
  broken: {
    label: 'Broken',
    Icon: ShieldXIcon,
    text: 'text-red-700 dark:text-red-400',
    badge:
      'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/50 dark:text-red-400 dark:ring-red-400/20',
    border: 'border-red-300 dark:border-red-800',
    arrow: 'text-red-500',
  },
};

const OVERALL_DESCRIPTION: Record<DnssecStatus, string> = {
  secure:
    'This domain has an unbroken DNSSEC chain of trust from the root zone down to its own zone.',
  insecure:
    'This domain is not protected by DNSSEC — no signed delegation was found, so its records cannot be cryptographically authenticated.',
  broken:
    'The DNSSEC chain of trust is broken — a DS record published by a parent zone does not match any of that zone’s DNSKEYs.',
};

const StatusBadge: FC<{ status: DnssecStatus }> = ({ status }) => {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        s.badge,
      )}
    >
      <s.Icon className="size-3.5" />
      {s.label}
    </span>
  );
};

const MatchIcon: FC<{ ok: boolean }> = ({ ok }) =>
  ok ? (
    <CheckIcon className="size-4 text-emerald-500" />
  ) : (
    <XIcon className="size-4 text-red-500" />
  );

const ZoneCard: FC<{ zone: DnssecZone }> = ({ zone }) => {
  const s = STATUS_STYLES[zone.status];
  const isRoot = zone.name === '.';

  return (
    <div
      className={cn(
        'w-full rounded-xl border bg-white dark:bg-zinc-900',
        s.border,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-inherit px-4 py-2.5">
        <span className="font-mono text-sm font-semibold break-all">
          {zone.displayName}
        </span>
        <StatusBadge status={zone.status} />
      </div>

      <div className="space-y-3 px-4 py-3">
        {/* Link from the parent: DS records (or the IANA anchor for the root). */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <LinkIcon className="size-3.5" />
            {isRoot
              ? 'IANA trust anchor'
              : 'Delegation Signer (DS) from parent'}
          </p>
          {zone.dsRecords.length ? (
            <ul className="space-y-1">
              {zone.dsRecords.map((ds, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 font-mono text-xs text-zinc-700 dark:text-zinc-300"
                >
                  <MatchIcon ok={ds.matched} />
                  <span>
                    keyTag {ds.keyTag} · {ds.algorithmName} · {ds.digestName}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500 italic dark:text-zinc-400">
              No DS record — unsigned delegation.
            </p>
          )}
        </div>

        {/* The zone's own DNSKEYs. */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <KeyRoundIcon className="size-3.5" />
            DNSKEYs
          </p>
          {zone.keys.length ? (
            <ul className="space-y-1">
              {zone.keys.map((key) => (
                <li
                  key={key.keyTag}
                  className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-700 dark:text-zinc-300"
                >
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                      key.isSep
                        ? 'bg-zinc-100 text-zinc-700 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700'
                        : 'bg-transparent text-zinc-500 ring-zinc-200 dark:text-zinc-400 dark:ring-zinc-700',
                    )}
                  >
                    {key.isSep ? 'KSK' : 'ZSK'}
                  </span>
                  <span>
                    keyTag {key.keyTag} · {key.algorithmName}
                  </span>
                  {key.linked && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckIcon className="size-3.5" /> linked
                    </span>
                  )}
                  {key.isRevoked && (
                    <span className="text-red-600 dark:text-red-400">
                      revoked
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500 italic dark:text-zinc-400">
              No DNSKEY — zone is not signed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

type ChainDiagramProps = {
  chain: DnssecChain;
};

export const ChainDiagram: FC<ChainDiagramProps> = ({ chain }) => {
  const overall = STATUS_STYLES[chain.overall];

  return (
    <div className="my-8 space-y-6">
      {/* Notices / overall status */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border p-4',
          overall.border,
        )}
      >
        <overall.Icon className={cn('mt-0.5 size-6 shrink-0', overall.text)} />
        <div className="space-y-1">
          <p className={cn('font-semibold', overall.text)}>
            DNSSEC {overall.label}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {OVERALL_DESCRIPTION[chain.overall]}
          </p>
        </div>
      </div>

      {/* Authentication chain, root at the top */}
      <div className="mx-auto flex max-w-xl flex-col items-center">
        {chain.zones.map((zone, i) => (
          <div key={zone.name} className="flex w-full flex-col items-center">
            {i > 0 && (
              <ArrowDownIcon
                className={cn('my-1 size-6', STATUS_STYLES[zone.status].arrow)}
              />
            )}
            <ZoneCard zone={zone} />
          </div>
        ))}
      </div>
    </div>
  );
};
