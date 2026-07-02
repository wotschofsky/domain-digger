import {
  CheckIcon,
  ClockIcon,
  FingerprintIcon,
  KeyRoundIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';

import {
  type DnssecChain,
  type DnssecDs,
  type DnssecKey,
  type DnssecRrset,
  type DnssecRrsetReason,
  type DnssecRrsetStatus,
  type DnssecStatus,
  type DnssecZone,
  isWeakKey,
} from '@/lib/dnssec';
import { cn } from '@/lib/utils';

import { IconAlert } from '../../_components/icon-alert';

// A first-principles DNSSEC view. The single question a user has is "can this
// domain's DNS be authenticated?", so the verdict leads the page and names
// exactly where (and why) the chain of trust stops or breaks. The chain itself
// is a vertical trust rail: root at the top, the queried domain at the bottom,
// each edge colored by its link state (matched DS / no DS / broken DS -- the
// last including an expired or invalid DNSKEY signature) so the break point is
// visible at a glance. Every zone's keys and DS records are
// shown inline -- no disclosure, no tooltips -- because the crypto evidence is
// the whole point. See lib/dnssec.ts for what the verdict does and doesn't
// cover.

const STATUS_DOT: Record<DnssecStatus, string> = {
  secure: 'bg-zinc-900 dark:bg-zinc-100',
  insecure: 'bg-zinc-300 dark:bg-zinc-600',
  broken: 'bg-red-500',
};

const STATUS_LABEL: Record<DnssecStatus, string> = {
  secure: 'Secure',
  insecure: 'Insecure',
  broken: 'Broken',
};

const RRSET_STATUS_LABEL: Record<DnssecRrsetStatus, string> = {
  secure: 'Secure',
  unsigned: 'Unsigned',
  bogus: 'Bogus',
  unsupported: 'Unsupported',
  absent: 'Absent',
  indeterminate: 'Unknown',
};

const RRSET_REASON_LABEL: Record<DnssecRrsetReason, string> = {
  validated: 'RRSIG validates',
  'no-records': 'No positive answer',
  'missing-rrsig': 'Records exist but no covering RRSIG was served',
  'unsupported-type': 'Record type is not implemented yet',
  'unsupported-rdata': 'Record data could not be canonicalized',
  'unauthenticated-signer': 'RRSIG signer is not DS-authenticated',
  expired: 'RRSIG is expired',
  'not-yet-valid': 'RRSIG is not valid yet',
  'invalid-signature': 'RRSIG does not verify',
  'lookup-failed': 'Lookup failed while probing this type',
};

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const decodeFlags = (flags: number): string => {
  const parts: string[] = [];
  if (flags & 0x0100) parts.push('ZONE');
  if (flags & 0x0001) parts.push('SEP');
  if (flags & 0x0080) parts.push('REVOKE');
  return parts.join(' + ') || 'none';
};

/** First zone whose link to its parent doesn't hold — where the chain ends. */
const breakIndex = (chain: DnssecChain): number =>
  chain.zones.findIndex((z) => z.status !== 'secure');

const zoneHeading = (zone: DnssecZone): string =>
  zone.name === '.' ? 'Root zone' : zone.name;

const shortDigest = (hex: string): string =>
  hex.length > 16 ? `${hex.slice(0, 8)}…${hex.slice(-6)}` : hex;

const visibleRrsets = (zone: DnssecZone | undefined): DnssecRrset[] =>
  (zone?.rrsets ?? []).filter((rrset) => rrset.status !== 'absent');

const rrsetProblems = (zone: DnssecZone | undefined): DnssecRrset[] =>
  visibleRrsets(zone).filter((rrset) =>
    ['bogus', 'unsigned', 'unsupported'].includes(rrset.status),
  );

const rrsetUnknowns = (zone: DnssecZone | undefined): DnssecRrset[] =>
  visibleRrsets(zone).filter((rrset) => rrset.status === 'indeterminate');

type MatrixTone = 'secure' | 'warn' | 'muted' | 'broken';

type MatrixItem = {
  label: string;
  value: string;
  detail: string;
  tone: MatrixTone;
};

const toneClasses: Record<MatrixTone, string> = {
  secure:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  muted: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  broken: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
};

const matrixItems = (chain: DnssecChain): MatrixItem[] => {
  const leaf = chain.zones.at(-1);
  const visible = leaf ? visibleRrsets(leaf) : [];
  const problems = rrsetProblems(leaf);
  const unknowns = rrsetUnknowns(leaf);
  const secure = visible.filter((rrset) => rrset.status === 'secure');
  const keySignatureBroken = chain.zones.some(
    (zone) => zone.breakReason === 'bad-signature',
  );

  return [
    {
      label: 'Delegation chain',
      value: STATUS_LABEL[chain.overall],
      detail:
        chain.overall === 'secure'
          ? 'DS links hold from the root trust anchor to the leaf zone.'
          : chain.overall === 'insecure'
            ? 'The chain stops at an unsigned delegation.'
            : 'A parent DS does not authenticate the child zone.',
      tone:
        chain.overall === 'secure'
          ? 'secure'
          : chain.overall === 'broken'
            ? 'broken'
            : 'muted',
    },
    {
      label: 'DNSKEY signatures',
      value: keySignatureBroken
        ? 'Broken'
        : chain.overall === 'secure'
          ? 'Secure'
          : 'Not anchored',
      detail:
        chain.overall === 'secure'
          ? 'Every authenticated zone has a valid DNSKEY RRset signature.'
          : keySignatureBroken
            ? 'A DNSKEY RRset signature is missing, expired, or invalid.'
            : 'DNSKEY signatures below an unsigned delegation are not trusted.',
      tone: keySignatureBroken
        ? 'broken'
        : chain.overall === 'secure'
          ? 'secure'
          : 'muted',
    },
    {
      label: 'Positive RRsets',
      value:
        visible.length === 0
          ? 'Not checked'
          : problems.length > 0
            ? `${problems.length} issue${problems.length === 1 ? '' : 's'}`
            : unknowns.length > 0
              ? `${secure.length} secure, ${unknowns.length} unknown`
              : `${secure.length} secure`,
      detail:
        visible.length === 0
          ? 'No existing leaf record sets were available for positive validation.'
          : problems.length > 0
            ? 'One or more existing record sets did not validate cleanly.'
            : unknowns.length > 0
              ? 'One or more record-set probes could not complete.'
              : 'Every existing leaf record set shown below has a valid RRSIG.',
      tone:
        visible.length === 0
          ? 'muted'
          : problems.length > 0 || unknowns.length > 0
            ? 'warn'
            : 'secure',
    },
    {
      label: 'Denial proofs',
      value: 'Not checked',
      detail:
        'NSEC and NSEC3 proofs for absent names or types are not validated yet.',
      tone: 'muted',
    },
  ];
};

/** Plain-language, chain-specific verdict for the header. */
const verdictBody = (chain: DnssecChain): string => {
  const zones = chain.zones;
  const leaf = zones.at(-1);
  if (!leaf) return '';
  const leafName = leaf.name === '.' ? 'the root zone' : leaf.name;

  if (chain.overall === 'secure') {
    const problems = rrsetProblems(leaf);
    if (problems.length > 0) {
      const types = problems.map((rrset) => rrset.type).join(', ');
      return `The delegation and DNSKEY chain is authenticated down to ${leafName}, but ${types} ${problems.length === 1 ? 'has' : 'have'} positive RRset validation issues.`;
    }
    const unknowns = rrsetUnknowns(leaf);
    if (unknowns.length > 0) {
      const types = unknowns.map((rrset) => rrset.type).join(', ');
      return `The delegation and DNSKEY chain is authenticated down to ${leafName}, but ${types} could not be checked.`;
    }
    const validated = visibleRrsets(leaf).filter(
      (rrset) => rrset.status === 'secure',
    );
    if (validated.length > 0) {
      return `Every link holds from the root trust anchor down to ${leafName}, and ${validated.length} existing record ${validated.length === 1 ? 'set has' : 'sets have'} valid, unexpired RRSIGs.`;
    }
    return `Every link holds from the root trust anchor down to ${leafName}: each zone's key set is DS-linked and its DNSKEY signature verifies and is unexpired.`;
  }

  const idx = breakIndex(chain);
  const brk = zones[idx];
  const brkName = brk.name === '.' ? 'the root zone' : brk.name;
  const parent = zones[idx - 1];
  const parentName = parent
    ? parent.name === '.'
      ? 'the root zone'
      : parent.name
    : 'its parent';

  if (chain.overall === 'broken') {
    if (brk.breakReason === 'no-dnskey') {
      return `${brkName} is vouched for by a DS record but serves no DNSKEY, so validating resolvers reject its answers as bogus.`;
    }
    if (brk.breakReason === 'bad-signature') {
      return `${brkName}'s keys are vouched for by its parent's DS, but the signature over its DNSKEY record set is expired or invalid, so validating resolvers reject its answers as bogus.`;
    }
    const ds = brk.dsRecords[0];
    return `${brkName}'s parent publishes a DS${ds ? ` (key tag ${ds.keyTag})` : ''} that matches none of its keys, so validating resolvers reject its answers as bogus.`;
  }

  // insecure
  if (brk.breakReason === 'unsupported-algorithm') {
    return `${brkName} is signed with an algorithm this checker can't verify, so validation stops at ${parentName}. Per RFC 4035 the zone is treated as insecure, not bogus.`;
  }
  if (brk.dsRecords.length === 0 && brk.keys.length === 0) {
    return `No DS record vouches for ${brkName}, so the chain of trust stops at ${parentName}. Its DNS records can't be authenticated — the default state for most domains.`;
  }
  return `The chain of trust stops at ${parentName}: ${brkName} is an unsigned delegation, so nothing below it (including ${leafName}) can be authenticated.`;
};

/**
 * Edge label + tone for the connector pointing from a parent into `zone`.
 * `inherited` marks zones below the first break: their status is propagated,
 * so the label must not restate the break zone's specific failure as if it
 * were this zone's own.
 */
const edgeState = (
  zone: DnssecZone,
  inherited = false,
): {
  label: string;
  line: string;
  text: string;
} => {
  if (zone.status === 'secure') {
    const ds = zone.dsRecords.find((d) => d.matched);
    return {
      label: ds
        ? `DS matches key tag ${ds.keyTag}`
        : 'Anchored by trust anchor',
      line: 'bg-zinc-300 dark:bg-zinc-600',
      text: 'text-zinc-500 dark:text-zinc-400',
    };
  }
  if (zone.status === 'broken') {
    const label = inherited
      ? 'Below a broken zone — not validated'
      : zone.breakReason === 'no-dnskey'
        ? 'DS present, no DNSKEY served'
        : zone.breakReason === 'bad-signature'
          ? 'DNSKEY signature expired or invalid'
          : 'DS matches no served key';
    return {
      label,
      line: 'bg-red-500/70',
      text: 'text-red-700 dark:text-red-400',
    };
  }
  return {
    // 'unsupported-algorithm' covers both an unusable DS and an unimportable
    // DS-linked key, so don't blame the DS specifically.
    label: inherited
      ? 'Below an unsigned delegation — not validated'
      : zone.breakReason === 'unsupported-algorithm'
        ? 'Unsupported algorithm — cannot validate'
        : 'No DS — unsigned delegation',
    line: 'bg-zinc-300 dark:bg-zinc-600',
    text: 'text-zinc-500 dark:text-zinc-400',
  };
};

const VerdictHeader: FC<{ chain: DnssecChain }> = ({ chain }) => {
  const leaf = chain.zones.at(-1);
  const problems = chain.overall === 'secure' ? rrsetProblems(leaf) : [];
  const unknowns = chain.overall === 'secure' ? rrsetUnknowns(leaf) : [];
  const Icon =
    problems.length > 0
      ? ShieldAlertIcon
      : chain.overall === 'secure'
        ? ShieldCheckIcon
        : chain.overall === 'broken'
          ? ShieldAlertIcon
          : ShieldOffIcon;
  const title =
    problems.length > 0
      ? 'Secure chain, RRset issues'
      : unknowns.length > 0
        ? 'Secure chain, partial RRsets'
        : STATUS_LABEL[chain.overall];

  return (
    <IconAlert icon={Icon} title={title} className="max-w-none">
      {verdictBody(chain)}
    </IconAlert>
  );
};

const FactChip: FC<{ children: ReactNode; tone?: 'warn' | 'muted' }> = ({
  children,
  tone = 'muted',
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
      toneClasses[tone],
    )}
  >
    {children}
  </span>
);

const SummaryChips: FC<{ chain: DnssecChain }> = ({ chain }) => {
  const leaf = chain.zones.at(-1);
  const chips: ReactNode[] = [];

  chips.push(
    <FactChip key="zones">{chain.zones.length} zones in chain</FactChip>,
  );

  const minBits = chain.zones
    .flatMap((z) => z.keys.map((k) => k.bits))
    .filter((b): b is number => b !== null)
    .reduce<number | null>(
      (min, b) => (min === null || b < min ? b : min),
      null,
    );
  if (minBits !== null) {
    // Weakness is algorithm-relative: 256-bit ECDSA/EdDSA keys are strong.
    const weak = chain.zones.some((z) => z.keys.some(isWeakKey));
    chips.push(
      <FactChip key="bits" tone={weak ? 'warn' : 'muted'}>
        <KeyRoundIcon className="size-3.5" />
        smallest key parameter {minBits}-bit
      </FactChip>,
    );
  }

  const deprecated = chain.zones.some((z) => z.keys.some((k) => k.deprecated));
  if (deprecated)
    chips.push(
      <FactChip key="depalg" tone="warn">
        <TriangleAlertIcon className="size-3.5" />
        deprecated algorithm
      </FactChip>,
    );

  const weakDigest = chain.zones.some((z) =>
    z.dsRecords.some((d) => d.weakDigest),
  );
  if (weakDigest)
    chips.push(
      <FactChip key="weakds" tone="warn">
        <TriangleAlertIcon className="size-3.5" />
        SHA-1 digest
      </FactChip>,
    );

  const revoked = chain.zones.some((z) => z.keys.some((k) => k.isRevoked));
  if (revoked)
    chips.push(
      <FactChip key="revoked" tone="muted">
        revoked key present
      </FactChip>,
    );

  if (leaf?.signatureExpiresAt !== undefined) {
    // Request-time wall-clock read in a server component (intentional, not memoized).
    // eslint-disable-next-line react-hooks/purity
    const expired = leaf.signatureExpiresAt < Date.now() / 1000;
    chips.push(
      <FactChip key="sig" tone={expired ? 'warn' : 'muted'}>
        <ClockIcon className="size-3.5" />
        {expired
          ? `signatures expired ${dateFmt.format(new Date(leaf.signatureExpiresAt * 1000))}`
          : `signatures valid until ${dateFmt.format(new Date(leaf.signatureExpiresAt * 1000))}`}
      </FactChip>,
    );
  }

  const visibleLeafRrsets = visibleRrsets(leaf);
  const secureRrsets = visibleLeafRrsets.filter(
    (rrset) => rrset.status === 'secure',
  );
  if (secureRrsets.length > 0) {
    chips.push(
      <FactChip key="rrsets" tone="muted">
        <CheckIcon className="size-3.5" />
        {secureRrsets.length} RRsets validated
      </FactChip>,
    );
  }

  const problemRrsets = rrsetProblems(leaf);
  if (problemRrsets.length > 0) {
    chips.push(
      <FactChip key="rrset-problems" tone="warn">
        <TriangleAlertIcon className="size-3.5" />
        {problemRrsets.length} RRset{' '}
        {problemRrsets.length === 1 ? 'issue' : 'issues'}
      </FactChip>,
    );
  }

  const unknownRrsets = rrsetUnknowns(leaf);
  if (unknownRrsets.length > 0) {
    chips.push(
      <FactChip key="rrset-unknowns" tone="warn">
        <TriangleAlertIcon className="size-3.5" />
        {unknownRrsets.length} RRset{unknownRrsets.length === 1 ? '' : 's'}{' '}
        unknown
      </FactChip>,
    );
  }

  return <div className="flex flex-wrap gap-2">{chips}</div>;
};

const ValidationMatrix: FC<{ chain: DnssecChain }> = ({ chain }) => (
  <section aria-label="Validation coverage">
    <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
      Validation coverage
    </h3>
    <dl className="grid gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800">
      {matrixItems(chain).map((item) => (
        <div key={item.label} className="bg-white p-3 dark:bg-zinc-900">
          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {item.label}
          </dt>
          <dd className="mt-2 space-y-2">
            <span
              className={cn(
                'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
                toneClasses[item.tone],
              )}
            >
              {item.value}
            </span>
            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {item.detail}
            </p>
          </dd>
        </div>
      ))}
    </dl>
  </section>
);

const WarnBadge: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase dark:bg-amber-950/50 dark:text-amber-300">
    {children}
  </span>
);

const KeyRow: FC<{ dnsKey: DnssecKey }> = ({ dnsKey: k }) => {
  const linked = k.isSep && k.linked;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase',
          'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
        )}
      >
        {linked && <CheckIcon className="size-3" />}
        {k.isSep ? 'KSK' : 'ZSK'}
      </span>
      <span className="font-mono text-zinc-900 dark:text-zinc-100">
        tag {k.keyTag}
      </span>
      <span className="text-zinc-500 dark:text-zinc-400">
        {k.algorithmName}
        {k.bits !== null && ` · ${k.bits}-bit`}
      </span>
      <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
        flags {k.flags} ({decodeFlags(k.flags)})
      </span>
      {k.isRevoked && (
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          revoked
        </span>
      )}
      {k.deprecated && <WarnBadge>deprecated</WarnBadge>}
    </li>
  );
};

const DsRow: FC<{ ds: DnssecDs }> = ({ ds }) => (
  <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase',
        ds.matched
          ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
          : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
      )}
    >
      {ds.matched ? (
        <CheckIcon className="size-3" />
      ) : (
        <XIcon className="size-3" />
      )}
      {ds.matched ? 'matches' : 'no match'}
    </span>
    <span className="font-mono text-zinc-900 dark:text-zinc-100">
      tag {ds.keyTag}
    </span>
    <span className="text-zinc-500 dark:text-zinc-400">{ds.digestName}</span>
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 dark:text-zinc-500">
      <FingerprintIcon className="size-3.5" />
      {shortDigest(ds.digestHex)}
    </span>
    {ds.weakDigest && <WarnBadge>SHA-1</WarnBadge>}
  </li>
);

const RrsetRow: FC<{ rrset: DnssecRrset }> = ({ rrset }) => {
  const isSecure = rrset.status === 'secure';
  const isBad = rrset.status === 'bogus';
  return (
    <li className="py-2 text-sm">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase',
              isSecure && toneClasses.secure,
              isBad && toneClasses.broken,
              !isSecure && !isBad && toneClasses.warn,
            )}
          >
            {isSecure ? (
              <CheckIcon className="size-3" />
            ) : (
              <TriangleAlertIcon className="size-3" />
            )}
            {RRSET_STATUS_LABEL[rrset.status]}
          </span>
          <span className="font-mono text-zinc-900 dark:text-zinc-100">
            {rrset.type}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {rrset.recordCount} record{rrset.recordCount === 1 ? '' : 's'}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {RRSET_REASON_LABEL[rrset.reason]}
          </span>
          {rrset.signerKeyTag !== undefined && (
            <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
              signer tag {rrset.signerKeyTag}
            </span>
          )}
          {rrset.signatureExpiresAt !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              <ClockIcon className="size-3.5" />
              until {dateFmt.format(new Date(rrset.signatureExpiresAt * 1000))}
            </span>
          )}
          <span className="text-xs text-zinc-400 group-open:hidden dark:text-zinc-500">
            Details
          </span>
        </summary>
        <dl className="mt-2 grid gap-x-6 gap-y-2 rounded-md bg-zinc-50 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4 dark:bg-zinc-800/70">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Signer</dt>
            <dd className="mt-0.5 font-mono text-zinc-800 dark:text-zinc-100">
              {rrset.signerName ?? 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Algorithm</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">
              {rrset.signerAlgorithmName ?? 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Valid from</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">
              {rrset.signatureInceptionAt
                ? dateTimeFmt.format(
                    new Date(rrset.signatureInceptionAt * 1000),
                  )
                : 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Valid until</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">
              {rrset.signatureExpiresAt
                ? dateTimeFmt.format(new Date(rrset.signatureExpiresAt * 1000))
                : 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Original TTL</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">
              {rrset.signatureOriginalTtl ?? 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Reason</dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">
              {RRSET_REASON_LABEL[rrset.reason]}
            </dd>
          </div>
        </dl>
      </details>
    </li>
  );
};

const ZoneDetail: FC<{ zone: DnssecZone; isLeaf: boolean }> = ({
  zone,
  isLeaf,
}) => {
  const rrsets = visibleRrsets(zone);
  return (
    <div className="space-y-4">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            <KeyRoundIcon className="size-3.5" />
            {zone.keys.length > 0
              ? `${zone.keys.length} key${zone.keys.length > 1 ? 's' : ''}`
              : 'Keys'}
          </h4>
          {zone.keys.length ? (
            <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
              {zone.keys.map((k) => (
                // Key tags are 16-bit checksums, not unique IDs.
                <KeyRow
                  key={`${k.keyTag}-${k.algorithm}-${k.flags}`}
                  dnsKey={k}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-1 py-2 text-sm text-zinc-500 italic dark:text-zinc-400">
              No DNSKEY served.
            </p>
          )}
        </section>

        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            <FingerprintIcon className="size-3.5" />
            {zone.name === '.'
              ? 'Trust anchor'
              : `${zone.dsRecords.length} DS from parent`}
          </h4>
          {zone.dsRecords.length ? (
            <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
              {zone.dsRecords.map((d) => (
                <DsRow key={`${d.keyTag}-${d.digestType}`} ds={d} />
              ))}
            </ul>
          ) : (
            <p className="mt-1 py-2 text-sm text-zinc-500 italic dark:text-zinc-400">
              No DS published.
            </p>
          )}
        </section>
      </div>

      {isLeaf && rrsets.length > 0 && (
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            <ShieldCheckIcon className="size-3.5" />
            Positive RRsets
          </h4>
          <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {rrsets.map((rrset) => (
              <RrsetRow key={rrset.type} rrset={rrset} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

const RailRow: FC<{
  zone: DnssecZone;
  isLast: boolean;
  inherited: boolean;
  // Line class of the edge spanning down into the NEXT zone -- coloring this
  // segment by the child's edge state puts the red/zinc on the actual break
  // edge instead of one segment too high.
  connectorLine?: string;
}> = ({ zone, isLast, inherited, connectorLine }) => {
  const edge = edgeState(zone, inherited);
  const isRoot = zone.name === '.';

  return (
    <div className="flex gap-3 sm:gap-4">
      {/* Rail column */}
      <div className="flex w-5 shrink-0 flex-col items-center sm:w-6">
        <span
          className={cn(
            'mt-3.5 size-3 shrink-0 rounded-full ring-4 ring-white dark:ring-zinc-900',
            STATUS_DOT[zone.status],
          )}
        />
        {connectorLine && (
          <span aria-hidden className={cn('my-1 w-px flex-1', connectorLine)} />
        )}
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1 pb-6">
        {!isRoot && (
          <div className={cn('mt-1 mb-1 text-xs font-medium', edge.text)}>
            {edge.label}
          </div>
        )}
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {zoneHeading(zone)}
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {isRoot && zone.status === 'secure'
              ? `Built-in IANA trust anchor (key tag ${zone.dsRecords
                  .filter((d) => d.matched)
                  .map((d) => d.keyTag)
                  .join(' & ')}).`
              : zone.status === 'secure'
                ? 'authenticated'
                : zone.status === 'broken'
                  ? 'bogus'
                  : 'unauthenticated'}
          </span>
        </div>
        <ZoneDetail zone={zone} isLeaf={isLast} />
      </div>
    </div>
  );
};

type ChainDiagramProps = {
  chain: DnssecChain;
};

export const ChainDiagram: FC<ChainDiagramProps> = ({ chain }) => {
  const firstBreak = breakIndex(chain);
  const isInherited = (i: number) => firstBreak !== -1 && i > firstBreak;

  return (
    <div className="space-y-6">
      <VerdictHeader chain={chain} />

      <SummaryChips chain={chain} />

      <ValidationMatrix chain={chain} />

      <section aria-label="Authentication chain">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Chain of trust · root to {chain.zones.at(-1)?.name ?? 'domain'}
        </h3>
        <ol className="m-0 list-none p-0">
          {chain.zones.map((zone, i) => {
            const next = chain.zones[i + 1];
            return (
              <li key={zone.name}>
                <RailRow
                  zone={zone}
                  isLast={!next}
                  inherited={isInherited(i)}
                  connectorLine={
                    next ? edgeState(next, isInherited(i + 1)).line : undefined
                  }
                />
              </li>
            );
          })}
        </ol>
      </section>

      <p className="border-t border-zinc-100 pt-5 text-xs leading-relaxed text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        This check verifies the DS-to-DNSKEY chain of trust from the IANA root
        anchor down to the domain and cryptographically validates the RRSIG over
        each zone&apos;s DNSKEY key set, including its expiry. For existing leaf
        records shown above, it also validates positive RRset signatures. It
        does not validate NSEC/NSEC3 denial-of-existence proofs, so absent names
        or missing record types are not authenticated here.
      </p>
    </div>
  );
};
