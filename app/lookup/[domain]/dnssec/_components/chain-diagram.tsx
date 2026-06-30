import {
  ArrowDownIcon,
  ClockIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type {
  DnssecChain,
  DnssecDs,
  DnssecKey,
  DnssecStatus,
  DnssecZone,
} from '@/lib/dnssec';
import { cn } from '@/lib/utils';

// A reskinned DNSSEC authentication graph (the DNSViz idea, made legible): the
// chain reads top-down as one card per zone (root -> queried domain), each
// showing its keys as nodes, the DS link to its parent, and -- on the leaf --
// the record sets it protects plus their signature freshness. Each node carries
// a details popover for the dense per-key/DS facts. See lib/dnssec.ts for what
// the verdict does and doesn't cover.

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

const STATUS_PILL: Record<DnssecStatus, string> = {
  secure:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400',
  insecure:
    'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  broken:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
};

const VERDICT_NOTE: Record<DnssecStatus, string> = {
  secure:
    'Every link holds from the root down to this domain, so its DNS answers can be cryptographically authenticated.',
  insecure:
    'The chain of trust stops before reaching this domain, so its DNS records cannot be cryptographically authenticated. This is the default for most domains.',
  broken:
    'A link in the chain is broken: a zone publishes a DS record that matches none of the keys it serves, so validating resolvers reject its answers.',
};

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const StatusDot: FC<{ status: DnssecStatus; className?: string }> = ({
  status,
  className,
}) => (
  <span
    className={cn('inline-block rounded-full', STATUS_DOT[status], className)}
  />
);

const StatusPill: FC<{ status: DnssecStatus }> = ({ status }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase',
      STATUS_PILL[status],
    )}
  >
    <StatusDot status={status} className="size-2" />
    {STATUS_LABEL[status]}
  </span>
);

/** Small amber pill flagging deprecated/weak crypto. */
const WarnBadge: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700 uppercase dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
    {children}
  </span>
);

const DetailRow: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex gap-3">
    <span className="w-20 shrink-0 text-zinc-400 dark:text-zinc-500">
      {label}
    </span>
    <span className="text-zinc-700 dark:text-zinc-200">{children}</span>
  </div>
);

/** DNSKEY flags decoded into their named bits (e.g. 257 -> ZONE + SEP). */
const decodeFlags = (flags: number): string => {
  const parts: string[] = [];
  if (flags & 0x0100) parts.push('ZONE');
  if (flags & 0x0001) parts.push('SEP');
  if (flags & 0x0080) parts.push('REVOKE');
  return parts.join(' + ') || 'none';
};

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
      ? `${matched.digestName} digest in the parent zone matches this zone's KSK ${matched.keyTag}.`
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

/** Label for the connector pointing down into the zone below. */
const connectorLabel = (below: DnssecZone): string => {
  switch (below.status) {
    case 'secure':
      return 'DS vouches for';
    case 'broken':
      return "DS doesn't match";
    default:
      return 'no signed delegation';
  }
};

const KeyNode: FC<{ keyData: DnssecKey }> = ({ keyData }) => {
  const isAnchor = keyData.isSep;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          className={cn(
            'cursor-help rounded-lg border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-400',
            isAnchor && keyData.linked
              ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40'
              : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50',
          )}
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            {isAnchor && keyData.linked && (
              <ShieldCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
            )}
            {isAnchor ? 'KSK · anchor key' : 'ZSK · signs records'}
            {keyData.isRevoked && (
              <span className="text-red-600 dark:text-red-400">(revoked)</span>
            )}
            {keyData.deprecated && <WarnBadge>deprecated</WarnBadge>}
          </div>
          <div className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
            tag{' '}
            <strong className="text-zinc-950 dark:text-white">
              {keyData.keyTag}
            </strong>{' '}
            · alg {keyData.algorithm}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {keyData.algorithmName}
            {keyData.bits !== null && ` · ${keyData.bits}-bit`}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1 text-xs">
        <DetailRow label="Key tag">{keyData.keyTag}</DetailRow>
        <DetailRow label="Role">
          {isAnchor ? 'Key-signing key (KSK)' : 'Zone-signing key (ZSK)'}
        </DetailRow>
        <DetailRow label="Flags">
          {keyData.flags} ({decodeFlags(keyData.flags)})
        </DetailRow>
        <DetailRow label="Algorithm">
          {keyData.algorithm} · {keyData.algorithmName}
          {keyData.deprecated && ' (deprecated)'}
        </DetailRow>
        <DetailRow label="Key length">
          {keyData.bits !== null ? `${keyData.bits}-bit` : 'unknown'}
        </DetailRow>
        <DetailRow label="Linked">
          {keyData.linked
            ? 'Anchored by the parent DS'
            : 'Not directly anchored'}
        </DetailRow>
      </TooltipContent>
    </Tooltip>
  );
};

const DsBadge: FC<{ zone: DnssecZone }> = ({ zone }) => {
  const ds: DnssecDs | undefined =
    zone.dsRecords.find((d) => d.matched) ?? zone.dsRecords[0];

  const pill = (
    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-xs font-bold text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400">
      DS
    </span>
  );

  if (!ds) return pill;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="cursor-help">
          {pill}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1 text-xs">
        <DetailRow label="Key tag">{ds.keyTag}</DetailRow>
        <DetailRow label="Digest">
          {ds.digestName}
          {ds.weakDigest && ' (deprecated)'}
        </DetailRow>
        <DetailRow label="Fingerprint">
          <span className="font-mono break-all">{ds.digestHex}</span>
        </DetailRow>
        <DetailRow label="Match">
          {ds.matched ? 'Matches a served DNSKEY' : 'No matching DNSKEY'}
        </DetailRow>
      </TooltipContent>
    </Tooltip>
  );
};

const SignatureHealth: FC<{ expiresAt: number }> = ({ expiresAt }) => {
  // Request-time wall-clock read in a server component (intentional, not memoized).
  // eslint-disable-next-line react-hooks/purity
  const expired = expiresAt < Date.now() / 1000;
  const date = dateFormat.format(new Date(expiresAt * 1000));

  // Only flag an *expired* signature: a real outage that validating resolvers
  // reject. We don't warn on a near date -- some providers (e.g. Cloudflare)
  // legitimately use short ~2-day windows and re-sign continuously, so an
  // "expiring soon" badge would false-alarm permanently.
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs',
        expired
          ? 'text-red-600 dark:text-red-400'
          : 'text-zinc-500 dark:text-zinc-400',
      )}
    >
      {expired ? (
        <TriangleAlertIcon className="size-3.5" />
      ) : (
        <ClockIcon className="size-3.5" />
      )}
      {expired
        ? `Signatures expired on ${date}`
        : `Signatures valid until ${date}`}
    </div>
  );
};

const ZoneCard: FC<{ zone: DnssecZone }> = ({ zone }) => {
  // KSKs (anchor keys) first, so the key the parent's DS points at leads.
  const keys = [...zone.keys].sort((a, b) => Number(b.isSep) - Number(a.isSep));
  const heading = zone.name === '.' ? 'Root zone' : zone.name;
  const signedTypes = zone.signedTypes ?? [];

  return (
    <article className="rounded-lg border border-zinc-200 p-4 sm:p-5 dark:border-zinc-700">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-lg font-semibold tracking-tight">
            {heading}
            {zone.name === '.' && <span className="ml-1 text-zinc-400">.</span>}
          </div>
          <div className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {zone.name === '.'
              ? 'Built-in IANA trust anchor'
              : 'Linked from its parent zone'}
          </div>
        </div>
        <StatusPill status={zone.status} />
      </div>

      {keys.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {keys.map((key) => (
            <KeyNode key={key.keyTag} keyData={key} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500 italic dark:text-zinc-400">
          This zone publishes no DNSKEY.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-zinc-200 pt-3.5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <DsBadge zone={zone} />
        <span>{linkSummary(zone)}</span>
        {zone.dsRecords.some((d) => d.weakDigest) && (
          <WarnBadge>SHA-1 digest</WarnBadge>
        )}
      </div>

      {signedTypes.length > 0 && (
        <div className="mt-3.5 space-y-2.5 border-t border-zinc-200 pt-3.5 dark:border-zinc-700">
          {zone.signatureExpiresAt !== undefined && (
            <SignatureHealth expiresAt={zone.signatureExpiresAt} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Signed records:
            </span>
            {signedTypes.map((type) => (
              <span
                key={type}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-mono text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

const Connector: FC<{ below: DnssecZone }> = ({ below }) => (
  <div className="flex items-center justify-center py-2.5">
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
      <ArrowDownIcon className="size-3.5" />
      {connectorLabel(below)}
    </span>
  </div>
);

type ChainDiagramProps = {
  chain: DnssecChain;
};

export const ChainDiagram: FC<ChainDiagramProps> = ({ chain }) => (
  <TooltipProvider delayDuration={150}>
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          DNSSEC authentication chain
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-zinc-500 dark:text-zinc-400">
          Trust starts at the internet root. Each parent zone publishes a DS
          fingerprint that matches its child&apos;s key, and that zone in turn
          signs its own records. Hover a key for its details.
        </p>
      </div>
      <StatusPill status={chain.overall} />
    </div>

    <div>
      {chain.zones.map((zone, i) => (
        <div key={zone.name}>
          {i > 0 && <Connector below={zone} />}
          <ZoneCard zone={zone} />
        </div>
      ))}
    </div>

    <p className="mt-6 max-w-prose text-sm text-zinc-500 dark:text-zinc-400">
      {VERDICT_NOTE[chain.overall]}
    </p>
  </TooltipProvider>
);
