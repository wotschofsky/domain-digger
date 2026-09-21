import type { DnskeyData, RrsigData } from 'dns-packet';
import { toType } from 'dns-packet/types';

import { SUPPORTED_SIGNING_ALGORITHMS } from './algorithms';
import { verifyWithDnskey } from './crypto';
import type { DnssecAnswerRecord } from './types';
import {
  canonicalOwnerForRrsig,
  canonicalRdata,
  canonicalRr,
  dnskeyKeyTag,
  isEligibleSigner,
  normalizeDomain,
  rrsigSigningPrefix,
} from './wire';

// RRSIG verification (RFC 4034 §3.1.8.1): decide what an RRset's covering
// signatures establish. Every RRset this checker validates -- a delegation's
// DS, a zone's DNSKEYs, the queried name's data -- goes through the one check
// below, so the ranking and downgrade rules cannot drift between them.

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
  // Verifies, but only as a wildcard expansion: proven just together with an
  // NSEC/NSEC3 denial that no closer name exists (RFC 4035 §5.3.4), which is
  // not validated here.
  | 'wildcard-expansion'
  // No RRSIG covers the type at all.
  | 'missing'
  // RRSIGs exist, but none was made by a trusted key.
  | 'unauthenticated-signer'
  // A trusted key signed with an algorithm this validator cannot run.
  | 'unsupported-algorithm'
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
  records: DnssecAnswerRecord[];
  // RRSIGs served with the answer; only those covering `type` count.
  rrsigs: RrsigData[];
  ownerName: string;
  signerName: string;
  // Keys trusted to sign this RRset -- an authenticated DNSKEY RRset, or just
  // its DS-linked keys when the RRset is that key set itself. Signatures by
  // any other key (including revoked ones, which RFC 5011 §2.1 strips from
  // the trusted set) carry no weight at all.
  keys: DnskeyData[];
  // Unix seconds the validity window is judged against.
  now: number;
  // False for RRsets that only exist at a zone apex or cut (DNSKEY, DS) and
  // so can never be a wildcard expansion.
  allowWildcard?: boolean;
};

const labelCount = (name: string): number => {
  const normalized = normalizeDomain(name);
  return normalized ? normalized.split('.').length : 0;
};

/**
 * Every RRSIG condition that does not require running its signing algorithm.
 * Checked before an algorithm is classified as unsupported: an arbitrary RRSIG
 * must not downgrade bogus data merely by naming an algorithm the checker
 * cannot execute.
 */
const metadataFailure = (
  rrsig: RrsigData,
  { ownerName, signerName, now, allowWildcard = true }: RrsetSignatureParams,
): 'expired' | 'not-yet-valid' | 'invalid' | null => {
  if (normalizeDomain(rrsig.signersName) !== normalizeDomain(signerName)) {
    return 'invalid';
  }
  const ownerLabels = labelCount(ownerName);
  if (
    rrsig.labels > ownerLabels ||
    (!allowWildcard && rrsig.labels !== ownerLabels)
  ) {
    return 'invalid';
  }
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
  { type, records, ownerName }: RrsetSignatureParams,
): boolean => {
  const rrType = toType(type);
  const prefix = rrsigSigningPrefix(rrsig);
  const signedOwner = canonicalOwnerForRrsig(ownerName, rrsig);
  if (!rrType || !prefix || signedOwner === null) return false;

  const rdatas = records
    .filter((record) => record.type === type)
    .map((record) => canonicalRdata(type, record.data));
  // Every record must canonicalize; a silently dropped one would let a
  // signature over the remainder pass for the whole set.
  if (rdatas.some((rdata) => rdata === null)) return false;
  const rrset = uniqueRdata(rdatas as Buffer[])
    .sort(Buffer.compare)
    .map((rdata) => canonicalRr(signedOwner, rrType, rrsig.originalTTL, rdata));

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
 *
 * RFC 6840 §5.11 downgrade resistance: a signature made with an algorithm this
 * validator can run outranks a co-published one it cannot, so a zone must not
 * turn a real failure into "unvalidatable" merely by also publishing an RRSIG
 * in an unimplemented algorithm. A clean supported signature counts, and so do
 * expired / not-yet-valid ones -- genuine failures of a path we could have
 * verified. A wrong signer name or label count is unauthenticated noise and
 * does not.
 */
export const checkRrsetSignatures = (
  params: RrsetSignatureParams,
): RrsetSignatureCheck => {
  const { type, rrsigs, ownerName, keys } = params;
  const covering = rrsigs.filter((rrsig) => rrsig.typeCovered === type);
  if (!covering.length) return { outcome: 'missing' };

  const valid: RrsigData[] = [];
  const expansions: RrsigData[] = [];
  const unsupported: RrsigData[] = [];
  const failures = {
    expired: [] as RrsigData[],
    'not-yet-valid': [] as RrsigData[],
    invalid: [] as RrsigData[],
  };
  let sawTrustedSigner = false;
  let sawSupportedPath = false;

  for (const rrsig of covering) {
    const candidates = signerCandidates(keys, rrsig);
    if (!candidates.length) continue;
    sawTrustedSigner = true;

    const supported = SUPPORTED_SIGNING_ALGORITHMS.has(rrsig.algorithm);
    const failure = metadataFailure(rrsig, params);
    if (failure) {
      failures[failure].push(rrsig);
      if (supported && failure !== 'invalid') sawSupportedPath = true;
    } else if (!supported) {
      unsupported.push(rrsig);
    } else {
      sawSupportedPath = true;
      if (!verifies(rrsig, candidates, params)) {
        failures.invalid.push(rrsig);
      } else if (
        // Fewer labels than the owner means the signed owner is a wildcard the
        // answer was expanded from -- unless the wildcard itself was queried.
        canonicalOwnerForRrsig(ownerName, rrsig) ===
        (normalizeDomain(ownerName) || '.')
      ) {
        valid.push(rrsig);
      } else {
        expansions.push(rrsig);
      }
    }
  }

  if (valid.length) return pick('valid', valid);
  if (expansions.length) return pick('wildcard-expansion', expansions);
  if (!sawTrustedSigner) return pick('unauthenticated-signer', covering);
  if (unsupported.length && !sawSupportedPath) {
    return pick('unsupported-algorithm', unsupported);
  }
  const outcome = failures.expired.length
    ? 'expired'
    : failures['not-yet-valid'].length
      ? 'not-yet-valid'
      : 'invalid';
  return pick(outcome, failures[outcome]);
};
