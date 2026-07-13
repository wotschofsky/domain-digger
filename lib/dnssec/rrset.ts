import type { DnskeyData, RrsigData } from 'dns-packet';
import { toType } from 'dns-packet/types';

import { algorithmName, SUPPORTED_SIGNING_ALGORITHMS } from './algorithms';
import { rrsigMetadataIssue, verifyRrsetRrsig } from './rrsig';
import type {
  DnssecAnswerRecord,
  DnssecRrset,
  DnssecRrsetFields,
  DnssecRrsetReason,
} from './types';
import { RRSET_STATUS_BY_REASON } from './types';
import { canonicalRdata, computeKeyTag, dnskeyRdata } from './wire';

// Positive leaf RRset validation: classify an answered RRset (secure /
// unsigned / bogus / ...) by checking its covering RRSIGs against the zone's
// DS-authenticated key set.

/**
 * Identity used to gate trusted signers. The 16-bit key tag alone can collide
 * across algorithms, so trust decisions pair it with the algorithm number.
 */
export const signerId = (algorithm: number, keyTag: number): string =>
  `${algorithm}:${keyTag}`;

export const rrsetResult = <Reason extends DnssecRrsetReason>(
  reason: Reason,
  fields: DnssecRrsetFields,
): Extract<DnssecRrset, { reason: Reason }> =>
  ({
    reason,
    status: RRSET_STATUS_BY_REASON[reason],
    ...fields,
  }) as Extract<DnssecRrset, { reason: Reason }>;

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

  const authenticatedKeys = keys.filter((key) =>
    authenticatedKeyIds.has(
      signerId(key.algorithm, computeKeyTag(dnskeyRdata(key))),
    ),
  );
  let sawAuthenticatedSigner = false;
  let sawUnsupportedSigner = false;
  let sawSupportedSigner = false;
  let failureReason: DnssecRrsetReason = 'invalid-signature';
  for (const rrsig of covering) {
    if (!authenticatedKeyIds.has(signerId(rrsig.algorithm, rrsig.keyTag))) {
      continue;
    }
    sawAuthenticatedSigner = true;
    const metadataIssue = rrsigMetadataIssue({
      rrsig,
      type,
      ownerName,
      signerName,
      keys: authenticatedKeys,
      now,
    });
    if (metadataIssue) {
      failureReason =
        metadataIssue === 'not-yet-valid'
          ? 'not-yet-valid'
          : metadataIssue === 'expired'
            ? 'expired'
            : 'invalid-signature';
      continue;
    }
    if (!SUPPORTED_SIGNING_ALGORITHMS.has(rrsig.algorithm)) {
      sawUnsupportedSigner = true;
      continue;
    }
    sawSupportedSigner = true;
    const verified = verifyRrsetRrsig({
      rrsig,
      type,
      records: typeRecords,
      ownerName,
      signerName,
      keys: authenticatedKeys,
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

  const fallbackReason: DnssecRrsetReason = sawSupportedSigner
    ? failureReason
    : sawUnsupportedSigner
      ? 'unsupported-algorithm'
      : sawAuthenticatedSigner
        ? failureReason
        : 'unauthenticated-signer';
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
