import {
  ArrowRightIcon,
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
import Link from 'next/link';
import type { FC, ReactNode } from 'react';

import type {
  DnssecBreakReason,
  DnssecChain,
  DnssecDs,
  DnssecKey,
  DnssecRrset,
  DnssecRrsetReason,
  DnssecRrsetStatus,
  DnssecSignatureEvidence,
  DnssecStatus,
  DnssecZone,
} from '@/lib/dnssec';
import { cn } from '@/lib/utils';

import { IconAlert } from '../../_components/icon-alert';
import { InfoTooltip } from './info-tooltip';

// A first-principles DNSSEC view. The single question a user has is "can this
// domain's DNS be authenticated?", so the verdict leads the page and names
// exactly where (and why) the chain of trust stops or breaks. The chain itself
// is a vertical trust rail: root at the top, the queried domain at the bottom,
// each edge colored by its link state (matched DS / no DS / broken DS -- the
// last including an expired or invalid DNSKEY signature) so the break point is
// visible at a glance. Every zone's keys and DS records are
// shown inline -- no disclosure, no tooltips -- because the crypto evidence is
// the whole point. See lib/dnssec for what the verdict does and doesn't
// cover.

const STATUS_DOT: Record<DnssecStatus, string> = {
  secure: 'bg-zinc-900 dark:bg-zinc-100',
  insecure: 'bg-zinc-300 dark:bg-zinc-600',
  broken: 'bg-red-500',
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
  'unsupported-algorithm': 'RRSIG algorithm is not supported',
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

// Chip tones stay within the app's zinc palette; red is reserved for the one
// state that is actually an error (bogus/broken).
const toneClasses = {
  muted: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  broken: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
};

type BreakContext = {
  zone: DnssecZone;
  zoneName: string;
  parentName: string;
};

type BreakPresentation = {
  body: (context: BreakContext) => string;
  remediation: (context: BreakContext) => string | null;
  edgeLabel: string;
};

const signatureFailureTime = (
  signature: DnssecSignatureEvidence | undefined,
): string =>
  signature?.status === 'expired' && signature.expiresAt !== undefined
    ? ` expired ${dateTimeFmt.format(new Date(signature.expiresAt * 1000))}`
    : ' expired or failed validation';

// One exhaustive policy table owns the copy and remediation for every break
// reason. Adding a reason cannot silently fall through to "DS mismatch" in one
// of several independent switch cascades.
const BREAK_PRESENTATION: Record<DnssecBreakReason, BreakPresentation> = {
  'bad-ds-signature': {
    body: ({ zoneName, parentName }) =>
      `${zoneName}'s DS record set could not be authenticated with ${parentName}'s keys, so it cannot establish a trusted link to this zone.`,
    remediation: () =>
      'To fix: the operator of the parent zone must restore a valid signature over the DS record set.',
    edgeLabel: 'DS record-set signature missing or invalid',
  },
  'no-dnskey': {
    body: ({ zoneName }) =>
      `${zoneName} is vouched for by a DS record but serves no DNSKEY, so validating resolvers reject its answers as bogus.`,
    remediation: () =>
      'To fix: re-enable DNSSEC signing at the DNS host, or remove the stale DS record via the registrar to return the zone to unsigned (but resolving) state.',
    edgeLabel: 'DS present, no DNSKEY served',
  },
  'bad-signature': {
    body: ({ zone, zoneName }) =>
      `${zoneName}'s keys are vouched for by its parent's DS, but the DNSKEY signature${signatureFailureTime(zone.dnskeySignature)}, so validating resolvers reject its answers as bogus.`,
    remediation: () =>
      'To fix: have the DNS host re-sign the zone. With managed DNS this means contacting the provider.',
    edgeLabel: 'DNSKEY signature expired or invalid',
  },
  'ds-mismatch': {
    body: ({ zone, zoneName }) => {
      const ds = zone.dsRecords[0];
      return `${zoneName}'s parent publishes a DS${ds ? ` (key tag ${ds.keyTag})` : ''} that matches none of its keys, so validating resolvers reject its answers as bogus.`;
    },
    remediation: ({ zone }) => {
      const expected = [...new Set(zone.dsRecords.map((ds) => ds.keyTag))].join(
        ', ',
      );
      const served =
        [...new Set(zone.keys.map((key) => key.keyTag))].join(', ') || 'none';
      return `To fix: update the DS record via the registrar to match a currently served key (the DS expects key tag ${expected}; served key tags: ${served}), or restore the matching key at the DNS host.`;
    },
    edgeLabel: 'DS matches no served key',
  },
  'unsupported-algorithm': {
    body: ({ zoneName, parentName }) =>
      `${zoneName} is signed with an authenticated algorithm this checker can't verify, so validation stops at ${parentName}. Per RFC 4035 the zone is treated as insecure, not bogus.`,
    remediation: () => null,
    edgeLabel: 'Unsupported algorithm — cannot validate',
  },
};

const queryObservationSentence = (chain: DnssecChain): string | null => {
  const name = chain.query.name;
  switch (chain.query.observation) {
    case 'unproved-nxdomain':
      return `The authoritative servers returned NXDOMAIN for ${name}, but NSEC/NSEC3 proofs are not validated yet, so the name's nonexistence is not authenticated.`;
    case 'unproved-nodata':
      return `No common positive record set was observed at ${name}; without negative-proof validation, that absence is not authenticated.`;
    case 'indeterminate':
      return `The positive records at ${name} could not be checked reliably.`;
    case 'positive':
    case 'not-checked':
      return null;
  }
};

type VerdictPresentation = {
  title: string;
  body: string;
  remediation: string | null;
};

/** Plain-language verdict derived once for the header. */
export const verdictPresentation = (
  chain: DnssecChain,
): VerdictPresentation => {
  const zones = chain.zones;
  const leaf = zones.at(-1);
  if (!leaf) return { title: 'Unknown', body: '', remediation: null };
  const leafName = leaf.name === '.' ? 'the root zone' : leaf.name;
  const observation = queryObservationSentence(chain);

  if (chain.status === 'secure') {
    if (chain.query.observation === 'unproved-nxdomain') {
      return {
        title: 'NXDOMAIN observed — not proven',
        body: `The DNSSEC chain is authenticated to ${leafName}. ${observation}`,
        remediation: null,
      };
    }
    if (chain.query.observation === 'unproved-nodata') {
      return {
        title: 'Secure chain, no records observed',
        body: `The DNSSEC chain is authenticated to ${leafName}. ${observation}`,
        remediation: null,
      };
    }
    const problems = rrsetProblems(leaf);
    if (problems.length > 0) {
      const types = problems.map((rrset) => rrset.type).join(', ');
      return {
        title: 'Secure chain, RRset issues',
        body: `The delegation and DNSKEY chain is authenticated down to ${leafName}, but ${types} ${problems.length === 1 ? 'has' : 'have'} positive RRset validation issues.`,
        remediation: null,
      };
    }
    const unknowns = rrsetUnknowns(leaf);
    if (unknowns.length > 0) {
      const types = unknowns.map((rrset) => rrset.type).join(', ');
      return {
        title: 'Secure chain, partial RRsets',
        body: `The delegation and DNSKEY chain is authenticated down to ${leafName}, but ${types} could not be checked.`,
        remediation: null,
      };
    }
    const validated = visibleRrsets(leaf).filter(
      (rrset) => rrset.status === 'secure',
    );
    if (validated.length > 0) {
      return {
        title: 'Secure',
        body: `Every link holds from the root trust anchor down to ${leafName}, and ${validated.length} existing record ${validated.length === 1 ? 'set has' : 'sets have'} valid, unexpired RRSIGs.`,
        remediation: null,
      };
    }
    return {
      title: 'Secure',
      body: `Every link holds from the root trust anchor down to ${leafName}: each zone's key set is DS-linked and its DNSKEY signature verifies and is unexpired.${observation ? ` ${observation}` : ''}`,
      remediation: null,
    };
  }

  const idx = breakIndex(chain);
  const brk = zones[idx];
  const zoneName = brk.name === '.' ? 'the root zone' : brk.name;
  const parent = zones[idx - 1];
  const parentName = parent
    ? parent.name === '.'
      ? 'the root zone'
      : parent.name
    : 'its parent';

  if (brk.breakReason) {
    const presentation = BREAK_PRESENTATION[brk.breakReason];
    const context = { zone: brk, zoneName, parentName };
    return {
      title:
        brk.breakReason === 'unsupported-algorithm'
          ? 'Cannot validate'
          : 'Broken',
      body: `${presentation.body(context)}${observation ? ` ${observation}` : ''}`,
      remediation: presentation.remediation(context),
    };
  }

  // An insecure zone with no reason is the observed unsigned cut. A broken
  // zone without a reason can only be inherited and cannot be the first break.
  if (brk.dsRecords.length === 0 && brk.keys.length === 0) {
    return {
      title: 'No DS observed',
      body: `No DS record was observed for ${zoneName}, so the chain of trust stops at ${parentName}. Because negative DNSSEC proofs are not checked yet, this is an observation rather than cryptographic proof that DNSSEC is disabled.${observation ? ` ${observation}` : ''}`,
      remediation:
        idx === chain.zones.length - 1
          ? 'To enable DNSSEC: turn on signing at the DNS host (most managed providers have a one-click option), then publish the DS record it produces via the registrar.'
          : null,
    };
  }
  return {
    title: chain.status === 'broken' ? 'Broken' : 'No DS observed',
    body: `No authenticated DS link was observed from ${parentName} to ${zoneName}, so nothing below it (including ${leafName}) can be authenticated. Negative proof validation is outside this check's current scope.${observation ? ` ${observation}` : ''}`,
    remediation: null,
  };
};

const leafAlias = (chain: DnssecChain): string | undefined =>
  chain.zones.at(-1)?.rrsets?.find((rrset) => rrset.type === 'CNAME')
    ?.cnameTarget;

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
    return {
      // The paired DS → DNSKEY row carries the exact match. Repeating the key
      // tag on the rail adds noise without adding evidence.
      label: '',
      line: 'bg-zinc-300 dark:bg-zinc-600',
      text: 'text-zinc-500 dark:text-zinc-400',
    };
  }
  if (zone.status === 'broken') {
    const label = inherited
      ? 'Below a broken zone — not validated'
      : zone.breakReason
        ? BREAK_PRESENTATION[zone.breakReason].edgeLabel
        : 'Authentication failed';
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
      ? 'Below an unauthenticated link — not validated'
      : zone.breakReason
        ? BREAK_PRESENTATION[zone.breakReason].edgeLabel
        : 'No DS observed — absence not proven',
    line: 'bg-zinc-300 dark:bg-zinc-600',
    text: 'text-zinc-500 dark:text-zinc-400',
  };
};

const VerdictHeader: FC<{ chain: DnssecChain }> = ({ chain }) => {
  const presentation = verdictPresentation(chain);
  const problems =
    chain.status === 'secure' ? rrsetProblems(chain.zones.at(-1)) : [];
  const hasUnprovedNegative =
    chain.query.observation === 'unproved-nxdomain' ||
    chain.query.observation === 'unproved-nodata' ||
    chain.query.observation === 'indeterminate';
  const Icon =
    problems.length > 0 || (chain.status === 'secure' && hasUnprovedNegative)
      ? ShieldAlertIcon
      : chain.status === 'secure'
        ? ShieldCheckIcon
        : chain.status === 'broken'
          ? ShieldAlertIcon
          : ShieldOffIcon;
  const alias = leafAlias(chain);

  return (
    <IconAlert icon={Icon} title={presentation.title} className="max-w-none">
      {presentation.body}
      {alias && (
        <p className="mt-2">
          This name is an alias (CNAME) for{' '}
          <Link
            className="font-medium underline underline-offset-4"
            href={`/lookup/${alias}/dnssec`}
          >
            {alias}
          </Link>
          . Its data lives at the target, whose own chain of trust is not
          validated here.
        </p>
      )}
      {presentation.remediation && (
        <p className="mt-2">{presentation.remediation}</p>
      )}
    </IconAlert>
  );
};

const WarnBadge: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">
    {children}
  </span>
);

const KeyRow: FC<{ dnsKey: DnssecKey }> = ({ dnsKey: k }) => {
  const linked = k.isSep && k.linked;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
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
    </div>
  );
};

const DsRow: FC<{ ds: DnssecDs }> = ({ ds }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
    <span className="font-mono text-zinc-900 dark:text-zinc-100">
      tag {ds.keyTag}
    </span>
    <span className="text-zinc-500 dark:text-zinc-400">
      {ds.algorithmName} · {ds.digestName}
    </span>
    <span
      className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 dark:text-zinc-500"
      title={ds.digestHex}
    >
      <FingerprintIcon className="size-3.5" />
      {shortDigest(ds.digestHex)}
    </span>
    {ds.weakDigest && <WarnBadge>SHA-1</WarnBadge>}
  </div>
);

const TrustLinkRow: FC<{ ds: DnssecDs; dnsKey?: DnssecKey }> = ({
  ds,
  dnsKey,
}) => (
  <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
    <DsRow ds={ds} />
    <ArrowRightIcon
      aria-label={dnsKey ? 'matches' : 'does not match'}
      className={cn(
        'size-4',
        dnsKey
          ? 'text-zinc-400 dark:text-zinc-500'
          : 'text-red-600 dark:text-red-400',
      )}
    />
    {dnsKey ? (
      <KeyRow dnsKey={dnsKey} />
    ) : (
      <div className="flex items-center gap-1.5 py-2 text-sm font-medium text-red-600 dark:text-red-400">
        <XIcon className="size-3.5" />
        No matching DNSKEY
      </div>
    )}
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
              isBad ? toneClasses.broken : toneClasses.muted,
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
          {rrset.cnameTarget && (
            <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
              → {rrset.cnameTarget}
            </span>
          )}
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

const signatureEvidenceDetail = (evidence: DnssecSignatureEvidence): string => {
  switch (evidence.status) {
    case 'valid':
      return evidence.expiresAt !== undefined
        ? `valid until ${dateTimeFmt.format(new Date(evidence.expiresAt * 1000))}`
        : 'valid';
    case 'expired':
      return evidence.expiresAt !== undefined
        ? `expired ${dateTimeFmt.format(new Date(evidence.expiresAt * 1000))}`
        : 'expired';
    case 'not-yet-valid':
      return evidence.inceptionAt !== undefined
        ? `not valid until ${dateTimeFmt.format(new Date(evidence.inceptionAt * 1000))}`
        : 'not yet valid';
    case 'missing':
      return 'no covering RRSIG observed';
    case 'unsupported':
      return evidence.expiresAt !== undefined
        ? `algorithm unsupported · observed expiry ${dateTimeFmt.format(new Date(evidence.expiresAt * 1000))}`
        : 'algorithm unsupported';
    case 'invalid':
      return evidence.expiresAt !== undefined
        ? `invalid · observed expiry ${dateTimeFmt.format(new Date(evidence.expiresAt * 1000))}`
        : 'invalid';
  }
};

const SignatureEvidence: FC<{
  label: string;
  evidence: DnssecSignatureEvidence;
}> = ({ label, evidence }) => (
  <div className="flex min-w-0 items-start gap-1.5 pl-1 py-2 text-xs text-zinc-500 dark:text-zinc-400">
    <ClockIcon
      className={cn(
        'mt-0.5 size-3.5 shrink-0',
        evidence.status === 'valid' ||
          evidence.status === 'unsupported' ||
          evidence.status === 'not-yet-valid'
          ? 'text-zinc-400 dark:text-zinc-500'
          : 'text-red-600 dark:text-red-400',
      )}
      aria-hidden
    />
    <span className="min-w-0">
      <span className="block font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <span className="block">{signatureEvidenceDetail(evidence)}</span>
    </span>
  </div>
);

const ZoneDetail: FC<{ zone: DnssecZone; isLeaf: boolean }> = ({
  zone,
  isLeaf,
}) => {
  const rrsets = visibleRrsets(zone);
  const linkedKeyIndexes = new Set(
    zone.dsRecords.flatMap((ds) => ds.matchedKeyIndexes),
  );
  const otherKeys = zone.keys.filter(
    (_key, index) => !linkedKeyIndexes.has(index),
  );
  const standaloneKeys = zone.dsRecords.length > 0 ? otherKeys : zone.keys;

  return (
    <div className="space-y-4">
      {zone.dsRecords.length > 0 && (
        <section>
          <div className="flex items-center gap-1">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              <FingerprintIcon className="size-3.5" />
              {zone.name === '.'
                ? 'Trust anchor → Root DNSKEY'
                : 'Parent DS → Child DNSKEY'}
            </h4>
            <InfoTooltip
              label={
                zone.name === '.'
                  ? 'trust anchor to root DNSKEY'
                  : 'parent DS to child DNSKEY'
              }
            >
              {zone.name === '.'
                ? 'DNSSEC needs a starting fact that is trusted without DNS proof. Domain Digger ships IANA’s root DS fingerprints as that trust anchor and checks that each one matches a root DNSKEY. The key-set signature below confirms that the root DNSKEY set is currently signed.'
                : 'A DS record is a fingerprint of a child zone’s DNSKEY, published by its parent. A match passes trust from the parent to the child; no match breaks the chain. The signatures below prove that the DS came from the parent and that the child’s DNSKEY set is signed.'}
            </InfoTooltip>
          </div>
          <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {zone.dsRecords.map((ds) => (
              <TrustLinkRow
                key={`${ds.keyTag}-${ds.algorithm}-${ds.digestType}-${ds.digestHex}`}
                ds={ds}
                dnsKey={zone.keys[ds.matchedKeyIndexes[0]]}
              />
            ))}
          </ul>
          {(zone.dsSignature || zone.dnskeySignature) && (
            <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] gap-3 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                {zone.dsSignature && (
                  <SignatureEvidence
                    label="Parent signature"
                    evidence={zone.dsSignature}
                  />
                )}
              </div>
              <span aria-hidden />
              <div>
                {zone.dnskeySignature && (
                  <SignatureEvidence
                    label="Key-set signature"
                    evidence={zone.dnskeySignature}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {(zone.dsRecords.length === 0 || standaloneKeys.length > 0) && (
        <section>
          <div className="flex items-center gap-1">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              <KeyRoundIcon className="size-3.5" />
              {zone.dsRecords.length > 0
                ? `${standaloneKeys.length} other DNSKEY${standaloneKeys.length === 1 ? '' : 's'} in this zone`
                : `${standaloneKeys.length} DNSKEY${standaloneKeys.length === 1 ? '' : 's'} in this zone`}
            </h4>
            <InfoTooltip
              label={zone.dsRecords.length > 0 ? 'other DNSKEYs' : 'DNSKEYs'}
            >
              {zone.dsRecords.length > 0
                ? 'These keys are not directly referenced by the parent. They can still be trusted because the matched KSK signs the whole DNSKEY set. Most are ZSKs that sign the zone’s records; extra KSKs may appear during key rollovers.'
                : 'DNSKEYs are the zone’s public keys. KSKs authenticate the DNSKEY set; ZSKs usually sign the zone’s DNS records.'}
            </InfoTooltip>
          </div>
          {standaloneKeys.length > 0 ? (
            <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
              {standaloneKeys.map((key) => (
                <li key={`${key.keyTag}-${key.algorithm}-${key.flags}`}>
                  <KeyRow dnsKey={key} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 py-2 text-sm text-zinc-500 italic dark:text-zinc-400">
              No DNSKEY served.
            </p>
          )}
        </section>
      )}

      {zone.dsRecords.length === 0 &&
        (zone.dsSignature || zone.dnskeySignature) && (
          <div className="flex flex-wrap gap-x-6">
            {zone.dsSignature && (
              <SignatureEvidence
                label="Parent signature"
                evidence={zone.dsSignature}
              />
            )}
            {zone.dnskeySignature && (
              <SignatureEvidence
                label="Key-set signature"
                evidence={zone.dnskeySignature}
              />
            )}
          </div>
        )}

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
        {!isRoot && edge.label && (
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
        This check authenticates each observed DS record set with its parent,
        verifies the DS-to-DNSKEY linkage from the IANA root anchor, and
        validates every zone&apos;s DNSKEY signature.{' '}
        {chain.coverage.checkedPositiveRrsetTypes.length > 0
          ? `At the queried name it checks these common positive types: ${chain.coverage.checkedPositiveRrsetTypes.join(', ')}. `
          : 'Positive records were not checked because the chain did not authenticate. '}
        It does not validate NSEC/NSEC3 negative proofs, discover unsigned
        subdelegations, or validate CNAME targets, so absent data is reported as
        observed rather than cryptographically proven.
      </p>
    </div>
  );
};
