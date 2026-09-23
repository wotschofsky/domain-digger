import type { DnskeyData, RrsigData } from 'dns-packet';
import { toType } from 'dns-packet/types';

import { verifyWithDnskey } from './crypto';
import {
  canonicalRr,
  dnskeyKeyTag,
  isEligibleSigner,
  normalizeDomain,
  rrsigSigningPrefix,
} from './wire';

// RRSIG verification (RFC 4034 §3.1.8.1): decide what an RRset's covering
// signatures establish.

/**
 * A 16-bit key tag is a checksum, not an identifier: distinct keys can share a
 * tag (and an attacker can craft one that does), so signer selection must try
 * every candidate matching the RRSIG's (algorithm, key tag) pair -- gating on
 * the pair alone would let a colliding key impersonate the real signer, and
 * picking only the first match would falsely reject the second of two
 * legitimately colliding keys. Keys carrying the REVOKE bit are excluded:
 * validators must not accept signatures from a key that revokes itself
 * (RFC 5011 §2.1).
 */
const signerCandidates = (keys: DnskeyData[], rrsig: RrsigData): DnskeyData[] =>
  keys.filter(
    (k) =>
      isEligibleSigner(k) &&
      k.algorithm === rrsig.algorithm &&
      dnskeyKeyTag(k) === rrsig.keyTag,
  );

export type RrsetSignatureOutcome =
  | 'valid'
  // No RRSIG covers the type at all.
  | 'missing'
  // RRSIGs exist, but none was made by a trusted key.
  | 'unauthenticated-signer'
  | 'expired'
  | 'not-yet-valid'
  | 'invalid';

type RrsetSignatureCheck = {
  outcome: RrsetSignatureOutcome;
  // The signature that explains the outcome. Its fields are observed claims
  // unless the outcome is `valid`. Absent only when `missing`.
  rrsig?: RrsigData;
};

type RrsetSignatureParams = {
  type: string;
  // Canonical RDATA of each record in the RRset (RFC 4034 §6.2).
  rdatas: Buffer[];
  // RRSIGs served with the answer; only those covering `type` count.
  rrsigs: RrsigData[];
  ownerName: string;
  signerName: string;
  // Keys trusted to sign this RRset. Signatures by any other key (including
  // revoked ones, which RFC 5011 §2.1 strips from the trusted set) carry no
  // weight at all.
  keys: DnskeyData[];
  // Unix seconds the validity window is judged against.
  now: number;
};

const labelCount = (name: string): number => {
  const normalized = normalizeDomain(name);
  return normalized ? normalized.split('.').length : 0;
};

/** Every RRSIG condition that does not require running its signing algorithm. */
const metadataFailure = (
  rrsig: RrsigData,
  { ownerName, signerName, now }: RrsetSignatureParams,
): 'expired' | 'not-yet-valid' | 'invalid' | null => {
  if (normalizeDomain(rrsig.signersName) !== normalizeDomain(signerName)) {
    return 'invalid';
  }
  // ponytail: exact label count, so no wildcard expansions; add RFC 4035
  // §5.3.4 handling when leaf RRsets (which can be expansions) get checked.
  if (rrsig.labels !== labelCount(ownerName)) return 'invalid';
  if (now < rrsig.inception) return 'not-yet-valid';
  if (now > rrsig.expiration) return 'expired';
  return null;
};

// An RRset is a set: duplicate copies of an identical RR in a packet must
// contribute one canonical entry, or the signed data diverges from what the
// signer hashed and a valid signature reads as bogus (RFC 4034 §6.3).
// ponytail: O(n^2) buffer scan; RRsets are a handful of records.
const uniqueRdata = (buffers: Buffer[]): Buffer[] =>
  buffers.filter(
    (buffer, index) =>
      buffers.findIndex((other) => other.equals(buffer)) === index,
  );

/** Whether `rrsig` cryptographically checks out over the canonical RRset. */
const verifies = (
  rrsig: RrsigData,
  candidates: DnskeyData[],
  { type, rdatas, ownerName }: RrsetSignatureParams,
): boolean => {
  const rrType = toType(type);
  const prefix = rrsigSigningPrefix(rrsig);
  if (!rrType || !prefix) return false;

  const rrset = uniqueRdata(rdatas)
    .sort(Buffer.compare)
    .map((rdata) => canonicalRr(ownerName, rrType, rrsig.originalTTL, rdata));

  const signedData = Buffer.concat([prefix, ...rrset]);
  return candidates.some((signer) =>
    verifyWithDnskey(signer, signedData, rrsig.signature),
  );
};

// Total order over every field a caller may display, longest-lived first, so
// the same DNS answer in any order reports the same signature. (Rollovers
// legitimately publish several RRSIGs at once.)
const evidenceOrder = (a: RrsigData, b: RrsigData): number =>
  b.expiration - a.expiration ||
  a.keyTag - b.keyTag ||
  a.algorithm - b.algorithm ||
  a.signersName.localeCompare(b.signersName) ||
  b.inception - a.inception ||
  a.originalTTL - b.originalTTL;

const pick = (
  outcome: RrsetSignatureOutcome,
  rrsigs: RrsigData[],
): RrsetSignatureCheck => ({
  outcome,
  rrsig: [...rrsigs].sort(
    (a, b) =>
      // What matters about a not-yet-valid RRset is when it becomes valid.
      (outcome === 'not-yet-valid' ? a.inception - b.inception : 0) ||
      evidenceOrder(a, b),
  )[0],
});

/**
 * What the RRSIGs covering one RRset establish. The longest-lived signature
 * that verifies wins; with none verifying, the outcome names the failure that
 * best explains why: expired before not-yet-valid before invalid.
 */
export const checkRrsetSignatures = (
  params: RrsetSignatureParams,
): RrsetSignatureCheck => {
  const { type, rrsigs, keys } = params;
  const covering = rrsigs.filter((rrsig) => rrsig.typeCovered === type);
  if (!covering.length) return { outcome: 'missing' };

  const valid: RrsigData[] = [];
  const failures = {
    expired: [] as RrsigData[],
    'not-yet-valid': [] as RrsigData[],
    invalid: [] as RrsigData[],
  };
  let sawTrustedSigner = false;

  for (const rrsig of covering) {
    const candidates = signerCandidates(keys, rrsig);
    if (!candidates.length) continue;
    sawTrustedSigner = true;

    const failure = metadataFailure(rrsig, params);
    if (failure) failures[failure].push(rrsig);
    else if (verifies(rrsig, candidates, params)) valid.push(rrsig);
    else failures.invalid.push(rrsig);
  }

  if (valid.length) return pick('valid', valid);
  if (!sawTrustedSigner) return pick('unauthenticated-signer', covering);
  const outcome = failures.expired.length
    ? 'expired'
    : failures['not-yet-valid'].length
      ? 'not-yet-valid'
      : 'invalid';
  return pick(outcome, failures[outcome]);
};
