import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
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

import {
  type DnssecBreakReason,
  type DnssecChain,
  type DnssecDs,
  type DnssecKey,
  type DnssecRrset,
  type DnssecRrsetReason,
  type DnssecRrsetStatus,
  type DnssecSignatureEvidence,
  type DnssecStatus,
  type DnssecVerdict,
  type DnssecZone,
  visibleRrsets,
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
// visible at a glance. Every zone's keys and DS records are shown inline
// because the crypto evidence is the whole point; only the per-RRset detail
// rows sit behind a disclosure, and tooltips explain terms rather than hide
// evidence. See lib/dnssec for what the verdict does and doesn't cover.

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
  'wildcard-no-denial-proof':
    'Signed as a wildcard expansion; the required nonexistence proof is not validated yet',
  'dname-synthesized':
    'CNAME synthesized from a DNAME; the signature lives on the DNAME, which is not validated yet',
};

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const zoneHeading = (zone: DnssecZone): string =>
  zone.name === '.' ? 'Root zone' : zone.name;

/** The root reads as prose mid-sentence, unlike the zone heading above. */
const zoneProse = (name: string): string =>
  name === '.' ? 'the root zone' : name;

const shortDigest = (hex: string): string =>
  hex.length > 16 ? `${hex.slice(0, 8)}…${hex.slice(-6)}` : hex;

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

/** The zone where the chain ended, plus the names the copy refers to. */
const breakContext = (chain: DnssecChain): BreakContext => {
  const zone = chain.zones[chain.breakAt ?? 0];
  const parent = chain.zones[(chain.breakAt ?? 0) - 1];
  return {
    zone,
    zoneName: zoneProse(zone.name),
    parentName: parent ? zoneProse(parent.name) : 'its parent',
  };
};

/**
 * Copy for the verdict the walk decided. Which outcome wins is policy and
 * lives in lib/dnssec/verdict.ts; this only puts it into words. The switch is
 * exhaustive, so a new outcome is a type error here rather than silent
 * fall-through to the wrong sentence.
 */
export const verdictPresentation = (
  chain: DnssecChain,
): VerdictPresentation => {
  const verdict = chain.verdict;
  const leafName = zoneProse(chain.zones.at(-1)?.name ?? '');
  const observation = queryObservationSentence(chain);
  const trailing = observation ? ` ${observation}` : '';

  switch (verdict.kind) {
    case 'unknown':
      return { title: 'Unknown', body: '', remediation: null };

    case 'nxdomain-unproved':
      return {
        title: 'NXDOMAIN observed — not proven',
        body:
          chain.status === 'secure'
            ? `The DNSSEC chain is authenticated to ${leafName}. ${observation}`
            : (observation ?? ''),
        remediation: null,
      };

    case 'secure-nodata':
      return {
        title: 'Secure chain, no records observed',
        body: `The DNSSEC chain is authenticated to ${leafName}. ${observation}`,
        remediation: null,
      };

    case 'secure-rrset-problems':
      return {
        title: 'Secure chain, RRset issues',
        body: `The delegation and DNSKEY chain is authenticated down to ${leafName}, but ${verdict.rrsetTypes.join(', ')} ${verdict.rrsetTypes.length === 1 ? 'has' : 'have'} positive RRset validation issues.`,
        remediation: null,
      };

    case 'secure-rrset-unchecked':
      return {
        title: 'Secure chain, partial RRsets',
        body: `The delegation and DNSKEY chain is authenticated down to ${leafName}, but ${verdict.rrsetTypes.join(', ')} could not be checked.`,
        remediation: null,
      };

    case 'secure-validated':
      return {
        title: 'Secure',
        body: `Every link holds from the root trust anchor down to ${leafName}, and ${verdict.validatedRrsetCount} existing record ${verdict.validatedRrsetCount === 1 ? 'set has' : 'sets have'} valid, unexpired RRSIGs.`,
        remediation: null,
      };

    case 'secure':
      return {
        title: 'Secure',
        body: `Every link holds from the root trust anchor down to ${leafName}: each zone's key set is DS-linked and its DNSKEY signature verifies and is unexpired.${trailing}`,
        remediation: null,
      };

    case 'break': {
      const presentation = BREAK_PRESENTATION[verdict.reason];
      const context = breakContext(chain);
      return {
        title:
          verdict.reason === 'unsupported-algorithm'
            ? 'Cannot validate'
            : 'Broken',
        body: `${presentation.body(context)}${trailing}`,
        remediation: presentation.remediation(context),
      };
    }

    case 'unsigned-cut': {
      const { zoneName, parentName } = breakContext(chain);
      return {
        title: 'No DS observed',
        body: `No DS record was observed for ${zoneName}, so the chain of trust stops at ${parentName}. Because negative DNSSEC proofs are not checked yet, this is an observation rather than cryptographic proof that DNSSEC is disabled.${trailing}`,
        remediation: verdict.atLeaf
          ? 'To enable DNSSEC: turn on signing at the DNS host (most managed providers have a one-click option), then publish the DS record it produces via the registrar.'
          : null,
      };
    }

    case 'no-authenticated-ds': {
      const { zoneName, parentName } = breakContext(chain);
      return {
        title: 'No DS observed',
        body: `No authenticated DS link was observed from ${parentName} to ${zoneName}, so nothing below it (including ${leafName}) can be authenticated. Negative proof validation is outside this check's current scope.${trailing}`,
        remediation: null,
      };
    }
  }
};

/**
 * Edge label + tone for the connector pointing from a parent into `zone`. A
 * zone below the break carries an inherited status, so the label must not
 * restate the break zone's specific failure as if it were this zone's own.
 */
const edgeState = (
  zone: DnssecZone,
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
    return {
      label: zone.inherited
        ? 'Below a broken zone — not validated'
        : BREAK_PRESENTATION[zone.breakReason].edgeLabel,
      line: 'bg-red-500/70',
      text: 'text-red-700 dark:text-red-400',
    };
  }
  return {
    // 'unsupported-algorithm' covers both an unusable DS and an unimportable
    // DS-linked key, so don't blame the DS specifically.
    label: zone.inherited
      ? 'Below an unauthenticated link — not validated'
      : zone.breakReason
        ? BREAK_PRESENTATION[zone.breakReason].edgeLabel
        : 'No DS observed — absence not proven',
    line: 'bg-zinc-300 dark:bg-zinc-600',
    text: 'text-zinc-500 dark:text-zinc-400',
  };
};

// Outcomes where the chain itself holds but the answer carries a caveat, so
// the icon warns rather than reassures. Everything else follows the chain's
// own status. Derived from the same verdict as the wording, so the icon and
// the sentence under it can no longer disagree.
const CAVEAT_VERDICTS = new Set<DnssecVerdict['kind']>([
  'nxdomain-unproved',
  'secure-nodata',
  'secure-rrset-problems',
  'secure-rrset-unchecked',
]);

const VerdictHeader: FC<{ chain: DnssecChain }> = ({ chain }) => {
  const presentation = verdictPresentation(chain);
  const Icon = CAVEAT_VERDICTS.has(chain.verdict.kind)
    ? ShieldAlertIcon
    : chain.status === 'secure'
      ? ShieldCheckIcon
      : chain.status === 'broken'
        ? ShieldAlertIcon
        : ShieldOffIcon;
  const alias = chain.leafAlias;

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
        flags {k.flags} ({k.flagNames})
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
    {ds.weakDigest && <WarnBadge>weak digest</WarnBadge>}
  </div>
);

const TrustLinkRow: FC<{ ds: DnssecDs }> = ({ ds }) => (
  <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
    <DsRow ds={ds} />
    <ArrowRightIcon
      aria-label={
        ds.matchedKey ? 'matches' : ds.standby ? 'standby' : 'does not match'
      }
      className={cn(
        'size-4',
        ds.matchedKey || ds.standby
          ? 'text-zinc-400 dark:text-zinc-500'
          : 'text-red-600 dark:text-red-400',
      )}
    />
    {ds.matchedKey ? (
      <KeyRow dnsKey={ds.matchedKey} />
    ) : ds.standby ? (
      <div className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
        Standby anchor · not in the current key set
      </div>
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
        <summary className="-mx-2 flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 focus-visible:outline-none dark:hover:bg-zinc-800/70">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
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
                {isSecure ? 'until' : 'observed until'}{' '}
                {dateFmt.format(new Date(rrset.signatureExpiresAt * 1000))}
              </span>
            )}
          </span>
          <ChevronDownIcon
            aria-hidden
            className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180 dark:text-zinc-500"
          />
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
            {/* An unverified signature's timestamps are observed claims, not
                a validated lifetime. */}
            <dt className="text-zinc-500 dark:text-zinc-400">
              {isSecure ? 'Valid from' : 'Observed inception'}
            </dt>
            <dd className="mt-0.5 text-zinc-800 dark:text-zinc-100">
              {rrset.signatureInceptionAt
                ? dateTimeFmt.format(
                    new Date(rrset.signatureInceptionAt * 1000),
                  )
                : 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">
              {isSecure ? 'Valid until' : 'Observed expiry'}
            </dt>
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
  <div className="flex min-w-0 items-start gap-1.5 py-2 pl-1 text-xs text-zinc-500 dark:text-zinc-400">
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
  // Keys not already shown paired with the DS that vouches for them.
  const standaloneKeys =
    zone.dsRecords.length > 0
      ? zone.keys.filter((key) => !key.dsMatched)
      : zone.keys;

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
              />
            ))}
          </ul>
          {(zone.dsSignature || zone.dnskeySignature) && (
            <div className="flex flex-wrap gap-x-8 border-t border-zinc-100 dark:border-zinc-800">
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

      {/* No branch for signature evidence without DS records: buildChain
          derives both signatures from the same anchors it builds dsRecords
          from, so a zone with no DS never carries either. */}

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
  // Line class of the edge spanning down into the NEXT zone -- coloring this
  // segment by the child's edge state puts the red/zinc on the actual break
  // edge instead of one segment too high.
  connectorLine?: string;
}> = ({ zone, isLast, connectorLine }) => {
  const edge = edgeState(zone);
  const isRoot = zone.name === '.';

  return (
    <div className="flex gap-3 sm:gap-4">
      {/* Rail column. The segment above the dot is colored by this zone's own
          incoming edge and the segment below by the next zone's, so adjacent
          rows join into one continuous line broken only by the dot's ring. */}
      <div className="flex w-5 shrink-0 flex-col items-center sm:w-6">
        <span
          aria-hidden
          className={cn('h-3.5 w-px shrink-0', !isRoot && edge.line)}
        />
        <span
          className={cn(
            'size-3 shrink-0 rounded-full',
            STATUS_DOT[zone.status],
          )}
        />
        {connectorLine && (
          <span aria-hidden className={cn('w-px flex-1', connectorLine)} />
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
                  .filter((d) => d.matchedKey)
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
  // The leaf carries one RRset per probed type, or none when it wasn't probed.
  const probedTypes = (chain.zones.at(-1)?.rrsets ?? []).map(
    (rrset) => rrset.type,
  );

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
                  connectorLine={next ? edgeState(next).line : undefined}
                />
              </li>
            );
          })}
        </ol>
      </section>

      <p className="border-t border-zinc-100 pt-5 text-xs leading-relaxed text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        This check authenticates each observed DS record set with its parent and
        verifies the DS-to-DNSKEY linkage and DNSKEY signature of every zone
        down from the IANA root anchor, stopping at the first link that does not
        hold.{' '}
        {probedTypes.length > 0
          ? `At the queried name it checks these common positive types: ${probedTypes.join(', ')}. `
          : 'Positive records were not checked because the chain did not authenticate. '}
        It does not validate NSEC/NSEC3 negative proofs, discover unsigned
        subdelegations, or validate CNAME targets, so absent data is reported as
        observed rather than cryptographically proven.
      </p>
    </div>
  );
};
