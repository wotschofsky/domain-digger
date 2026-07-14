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
import {
  canonicalOwnerForRrsig,
  canonicalRdata,
  computeKeyTag,
  dnskeyRdata,
} from './wire';

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
  let bestValid: RrsigData | null = null;
  let bestWildcardValid: RrsigData | null = null;
  // Every authenticated failure, so reason and evidence can be derived from
  // one deterministically chosen signature instead of loop order.
  const failures: Array<{
    rrsig: RrsigData;
    reason: 'expired' | 'not-yet-valid' | 'invalid-signature';
  }> = [];
  for (const rrsig of covering) {
    // Signatures by unauthenticated signers (including revoked keys, which
    // RFC 5011 §2.1 strips from the trusted set) carry no weight at all: they
    // must influence neither validation nor the supported-vs-unsupported
    // ranking below.
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
      failures.push({
        rrsig,
        reason:
          metadataIssue === 'not-yet-valid'
            ? 'not-yet-valid'
            : metadataIssue === 'expired'
              ? 'expired'
              : 'invalid-signature',
      });
      // An expired or not-yet-valid supported-algorithm signature outranks a
      // co-published in-window unsupported one (RFC 6840 §5.11) -- without
      // this, the unsupported fallback below would mask the real failure.
      if (
        SUPPORTED_SIGNING_ALGORITHMS.has(rrsig.algorithm) &&
        (metadataIssue === 'expired' || metadataIssue === 'not-yet-valid')
      ) {
        sawSupportedSigner = true;
      }
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
    if (!verified) {
      failures.push({ rrsig, reason: 'invalid-signature' });
      continue;
    }
    // A signature covering fewer labels than the owner authenticates a
    // wildcard expansion, which is only proven together with an NSEC/NSEC3
    // denial that no closer name exists (RFC 4035 §5.3.4) -- not validated
    // here, so it must not count as fully validated.
    const isExpansion =
      canonicalOwnerForRrsig(ownerName, rrsig) !==
      (ownerName.replace(/\.$/, '').toLowerCase() || '.');
    // Rollovers legitimately publish several currently-valid RRSIGs; report
    // the longest-lived one (like the DNSKEY/DS paths do) so the expiry shown
    // doesn't depend on response order.
    if (isExpansion) {
      if (!bestWildcardValid || rrsig.expiration > bestWildcardValid.expiration)
        bestWildcardValid = rrsig;
    } else if (!bestValid || rrsig.expiration > bestValid.expiration) {
      bestValid = rrsig;
    }
  }

  const bestVerified = bestValid ?? bestWildcardValid;
  if (bestVerified) {
    return rrsetResult(bestValid ? 'validated' : 'wildcard-no-denial-proof', {
      type,
      recordCount: typeRecords.length,
      signerName: bestVerified.signersName,
      signerKeyTag: bestVerified.keyTag,
      signerAlgorithmName: algorithmName(bestVerified.algorithm),
      signatureInceptionAt: bestVerified.inception,
      signatureExpiresAt: bestVerified.expiration,
      signatureOriginalTtl: bestVerified.originalTTL,
    });
  }

  // Deterministic failure selection: bucket priority (expired before
  // not-yet-valid before invalid, mirroring the DNSKEY/DS evidence order),
  // longest-lived signature within the bucket. Reordering the same DNS
  // answer must not change the reported reason or its evidence.
  let chosen: (typeof failures)[number] | undefined;
  for (const reason of [
    'expired',
    'not-yet-valid',
    'invalid-signature',
  ] as const) {
    const bucket = failures.filter((failure) => failure.reason === reason);
    if (bucket.length) {
      chosen = bucket.reduce((best, failure) =>
        failure.rrsig.expiration > best.rrsig.expiration ? failure : best,
      );
      break;
    }
  }
  const failureReason = chosen?.reason ?? 'invalid-signature';
  const fallbackReason: DnssecRrsetReason = sawSupportedSigner
    ? failureReason
    : sawUnsupportedSigner
      ? 'unsupported-algorithm'
      : sawAuthenticatedSigner
        ? failureReason
        : 'unauthenticated-signer';
  const evidence = chosen?.rrsig ?? covering[0];
  return rrsetResult(fallbackReason, {
    type,
    recordCount: typeRecords.length,
    signerName: evidence?.signersName,
    signerKeyTag: evidence?.keyTag,
    signerAlgorithmName: evidence
      ? algorithmName(evidence.algorithm)
      : undefined,
    signatureInceptionAt: evidence?.inception,
    signatureExpiresAt: evidence?.expiration,
    signatureOriginalTtl: evidence?.originalTTL,
  });
}
