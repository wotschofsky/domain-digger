import type { DnskeyData, RrsigData } from 'dns-packet';
import { toType } from 'dns-packet/types';

import { algorithmName } from './algorithms';
import { checkRrsetSignatures, type RrsetSignatureOutcome } from './rrsig';
import type {
  DnssecAnswerRecord,
  DnssecRrset,
  DnssecRrsetFields,
  DnssecRrsetReason,
} from './types';
import { RRSET_STATUS_BY_REASON } from './types';
import { canonicalRdata, normalizeDomain } from './wire';

// Positive leaf RRset validation: classify an answered RRset (secure /
// unsigned / bogus / ...) by checking its covering RRSIGs against the zone's
// DS-authenticated key set.

export const rrsetResult = <Reason extends DnssecRrsetReason>(
  reason: Reason,
  fields: DnssecRrsetFields,
): Extract<DnssecRrset, { reason: Reason }> =>
  ({
    reason,
    status: RRSET_STATUS_BY_REASON[reason],
    ...fields,
  }) as Extract<DnssecRrset, { reason: Reason }>;

const REASON_BY_OUTCOME: Record<RrsetSignatureOutcome, DnssecRrsetReason> = {
  valid: 'validated',
  'wildcard-expansion': 'wildcard-no-denial-proof',
  missing: 'missing-rrsig',
  'unauthenticated-signer': 'unauthenticated-signer',
  'unsupported-algorithm': 'unsupported-algorithm',
  expired: 'expired',
  'not-yet-valid': 'not-yet-valid',
  invalid: 'invalid-signature',
};

type Dname = { name: string; target: string };

/**
 * Whether `cnameTarget` at `name` is exactly the CNAME a server would
 * synthesize from one of the answered DNAMEs (RFC 6672 §2.2): the name must
 * lie strictly below a DNAME owner, and the target must be the queried
 * prefix grafted onto the DNAME target. An unrelated DNAME in the answer
 * must not excuse an unsigned CNAME.
 */
const isDnameSynthesized = (
  name: string,
  cnameTarget: string,
  dnames: Dname[],
): boolean => {
  const qname = normalizeDomain(name);
  const cname = normalizeDomain(cnameTarget);
  return dnames.some(({ name: owner, target }) => {
    const dnameOwner = normalizeDomain(owner);
    const dnameTarget = normalizeDomain(target);
    if (!dnameOwner || !qname.endsWith(`.${dnameOwner}`)) return false;
    const prefix = qname.slice(0, qname.length - dnameOwner.length - 1);
    return cname === (dnameTarget ? `${prefix}.${dnameTarget}` : prefix);
  });
};

export const validatePositiveRrset = (params: {
  type: string;
  ownerName: string;
  records: DnssecAnswerRecord[];
  rrsigs: RrsigData[];
  // The signing zone's DNSKEY RRset, already authenticated by the chain: any
  // eligible key in it may sign data. Most zones use a ZSK for that, while
  // only the KSK is directly DS-linked.
  keys: DnskeyData[];
  signerName: string;
  now: number;
  // DNAMEs served in the same answer, for recognizing a synthesized CNAME.
  dnames?: Dname[];
}): DnssecRrset => {
  const { type, ownerName, records, rrsigs, keys, signerName, now } = params;
  const typeRecords = records.filter((record) => record.type === type);
  const target = type === 'CNAME' ? typeRecords[0]?.data : undefined;
  const fields: DnssecRrsetFields = {
    type,
    recordCount: typeRecords.length,
    // Surface the alias target: a validated CNAME only authenticates the
    // pointer, not the target's chain, and the UI must say so.
    ...(typeof target === 'string' && { cnameTarget: normalizeDomain(target) }),
  };

  if (typeRecords.length === 0) return rrsetResult('no-records', fields);
  if (!toType(type)) return rrsetResult('unsupported-type', fields);
  if (
    typeRecords.some((record) => canonicalRdata(type, record.data) === null)
  ) {
    return rrsetResult('unsupported-rdata', fields);
  }

  const { outcome, rrsig } = checkRrsetSignatures({
    type,
    records: typeRecords,
    rrsigs,
    ownerName,
    signerName,
    keys,
    now,
  });

  // A CNAME synthesized from a DNAME intentionally carries no RRSIG; the
  // signature lives on the DNAME (not validated here). Don't misreport such
  // deployments as serving unsigned records -- but only when the CNAME really
  // is the DNAME's substitution, so an unrelated DNAME can't excuse a
  // genuinely unsigned CNAME.
  if (
    outcome === 'missing' &&
    typeof target === 'string' &&
    isDnameSynthesized(ownerName, target, params.dnames ?? [])
  ) {
    return rrsetResult('dname-synthesized', fields);
  }

  return rrsetResult(REASON_BY_OUTCOME[outcome], {
    ...fields,
    // Observed fields, even when the signature does not verify.
    ...(rrsig && {
      signerName: rrsig.signersName,
      signerKeyTag: rrsig.keyTag,
      signerAlgorithmName: algorithmName(rrsig.algorithm),
      signatureInceptionAt: rrsig.inception,
      signatureExpiresAt: rrsig.expiration,
      signatureOriginalTtl: rrsig.originalTTL,
    }),
  });
};
