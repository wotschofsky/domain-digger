import type { DnskeyData, RrsigData } from 'dns-packet';
import { toType } from 'dns-packet/types';

import { algorithmName } from './algorithms';
import { verifyRrsetRrsig } from './rrsig';
import type {
  DnssecAnswerRecord,
  DnssecRrset,
  DnssecRrsetReason,
  DnssecRrsetStatus,
} from './types';
import { canonicalRdata } from './wire';

// Positive leaf RRset validation: classify an answered RRset (secure /
// unsigned / bogus / ...) by checking its covering RRSIGs against the zone's
// DS-authenticated key set.

/**
 * Identity used to gate trusted signers. The 16-bit key tag alone can collide
 * across algorithms, so trust decisions pair it with the algorithm number.
 */
export const signerId = (algorithm: number, keyTag: number): string =>
  `${algorithm}:${keyTag}`;

// An RRset's status is fully determined by its reason; constructing results
// through rrsetResult keeps impossible pairs (e.g. secure + expired) out of
// the model.
const STATUS_BY_REASON: Record<DnssecRrsetReason, DnssecRrsetStatus> = {
  validated: 'secure',
  'no-records': 'absent',
  'missing-rrsig': 'unsigned',
  'unsupported-type': 'unsupported',
  'unsupported-rdata': 'unsupported',
  'unauthenticated-signer': 'bogus',
  expired: 'bogus',
  'not-yet-valid': 'bogus',
  'invalid-signature': 'bogus',
  'lookup-failed': 'indeterminate',
};

export const rrsetResult = (
  reason: DnssecRrsetReason,
  fields: Omit<DnssecRrset, 'status' | 'reason'>,
): DnssecRrset => ({ reason, status: STATUS_BY_REASON[reason], ...fields });

export function validatePositiveRrset(params: {
  type: string;
  ownerName: string;
  records: DnssecAnswerRecord[];
  rrsigs: RrsigData[];
  keys: DnskeyData[];
  // signerId()s of the keys in the DS-authenticated DNSKEY RRset.
  authenticatedKeyIds: Set<string>;
  signerName: string;
  now?: number;
}): DnssecRrset {
  const {
    type,
    ownerName,
    records,
    rrsigs,
    keys,
    authenticatedKeyIds,
    signerName,
    now = Math.floor(Date.now() / 1000),
  } = params;
  const typeRecords = records.filter((record) => record.type === type);

  if (typeRecords.length === 0) {
    return rrsetResult('no-records', { type, recordCount: 0 });
  }

  if (!toType(type)) {
    return rrsetResult('unsupported-type', {
      type,
      recordCount: typeRecords.length,
    });
  }

  if (
    typeRecords.some((record) => canonicalRdata(type, record.data) === null)
  ) {
    return rrsetResult('unsupported-rdata', {
      type,
      recordCount: typeRecords.length,
    });
  }

  const covering = rrsigs.filter((rrsig) => rrsig.typeCovered === type);
  if (covering.length === 0) {
    return rrsetResult('missing-rrsig', {
      type,
      recordCount: typeRecords.length,
    });
  }

  let fallbackReason: DnssecRrsetReason = 'invalid-signature';
  for (const rrsig of covering) {
    if (!authenticatedKeyIds.has(signerId(rrsig.algorithm, rrsig.keyTag))) {
      fallbackReason = 'unauthenticated-signer';
      continue;
    }
    if (now < rrsig.inception) {
      fallbackReason = 'not-yet-valid';
      continue;
    }
    if (now > rrsig.expiration) {
      fallbackReason = 'expired';
      continue;
    }
    const verified = verifyRrsetRrsig({
      rrsig,
      type,
      records: typeRecords,
      ownerName,
      signerName,
      keys,
      now,
    });
    if (verified) {
      return rrsetResult('validated', {
        type,
        recordCount: typeRecords.length,
        signerName: rrsig.signersName,
        signerKeyTag: rrsig.keyTag,
        signerAlgorithmName: algorithmName(rrsig.algorithm),
        signatureInceptionAt: rrsig.inception,
        signatureExpiresAt: rrsig.expiration,
        signatureOriginalTtl: rrsig.originalTTL,
      });
    }
  }

  const firstCovering = covering[0];
  return rrsetResult(fallbackReason, {
    type,
    recordCount: typeRecords.length,
    signerName: firstCovering?.signersName,
    signerKeyTag: firstCovering?.keyTag,
    signerAlgorithmName: firstCovering
      ? algorithmName(firstCovering.algorithm)
      : undefined,
    signatureInceptionAt: firstCovering?.inception,
    signatureExpiresAt: Math.min(...covering.map((rrsig) => rrsig.expiration)),
    signatureOriginalTtl: firstCovering?.originalTTL,
  });
}
