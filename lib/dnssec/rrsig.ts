import type { DnskeyData, RrsigData } from 'dns-packet';
import { toType } from 'dns-packet/types';

import { dnskeyToPublicKey, verifySignature } from './crypto';
import type { DnssecAnswerRecord } from './types';
import {
  canonicalOwnerForRrsig,
  canonicalRdata,
  canonicalRr,
  computeKeyTag,
  dnskeyRdata,
  normalizeDomain,
  rrsigSigningPrefix,
} from './wire';

// RRSIG signature verification (RFC 4034 §3.1.8.1): reconstruct the canonical
// signed bytes for an RRset and check them against candidate signing keys.

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
      (k.flags & 0x0100) !== 0 &&
      (k.flags & 0x0080) === 0 &&
      k.algorithm === rrsig.algorithm &&
      computeKeyTag(dnskeyRdata(k)) === rrsig.keyTag,
  );

export type RrsigMetadataIssue =
  | 'wrong-type'
  | 'wrong-signer'
  | 'invalid-label-count'
  | 'not-yet-valid'
  | 'expired'
  | 'ineligible-signer';

const labelCount = (name: string): number => {
  const normalized = normalizeDomain(name);
  return normalized ? normalized.split('.').length : 0;
};

/**
 * Validate every RRSIG condition that does not require running its signing
 * algorithm. This is also used before classifying an algorithm as unsupported:
 * an arbitrary RRSIG must not downgrade bogus data merely by naming an
 * algorithm the checker cannot execute.
 */
export function rrsigMetadataIssue(params: {
  rrsig: RrsigData;
  type: string;
  ownerName: string;
  signerName: string;
  keys: DnskeyData[];
  now: number;
  allowWildcard?: boolean;
}): RrsigMetadataIssue | null {
  const {
    rrsig,
    type,
    ownerName,
    signerName,
    keys,
    now,
    allowWildcard = true,
  } = params;
  if (rrsig.typeCovered !== type) return 'wrong-type';
  if (normalizeDomain(rrsig.signersName) !== normalizeDomain(signerName)) {
    return 'wrong-signer';
  }
  const ownerLabels = labelCount(ownerName);
  if (
    rrsig.labels > ownerLabels ||
    (!allowWildcard && rrsig.labels !== ownerLabels)
  ) {
    return 'invalid-label-count';
  }
  if (now < rrsig.inception) return 'not-yet-valid';
  if (now > rrsig.expiration) return 'expired';
  if (!signerCandidates(keys, rrsig).length) return 'ineligible-signer';
  return null;
}

// An RRset is a set: duplicate copies of an identical RR in a packet must
// contribute one canonical entry, or the signed data diverges from what the
// signer hashed and a valid signature reads as bogus (RFC 4034 §6.3).
// ponytail: O(n^2) buffer scan; RRsets are a handful of records.
const uniqueRdata = (buffers: Buffer[]): Buffer[] =>
  buffers.filter(
    (buffer, index) =>
      buffers.findIndex((other) => other.equals(buffer)) === index,
  );

const verifiedByAnyCandidate = (
  candidates: DnskeyData[],
  rrsig: RrsigData,
  signedData: Buffer,
): boolean =>
  candidates.some((signer) => {
    const publicKey = dnskeyToPublicKey(signer.algorithm, signer.key);
    return (
      publicKey !== null &&
      verifySignature(signer.algorithm, signedData, rrsig.signature, publicKey)
    );
  });

/**
 * Verify an RRSIG over a zone's DNSKEY RRset: the signature must be produced by
 * one of the trusted `signers` (matched by tag + algorithm; defaults to all of
 * `keys`), be within its validity window at `now` (Unix seconds), and
 * cryptographically check out over the canonical DNSKEY RRset (RFC 4034 §6).
 * The RRset is every DNSKEY in `keys`, sorted by canonical RDATA (§6.3).
 * Returns false on any failure -- expired, forged, unsupported algorithm, or
 * malformed key.
 */
export function verifyDnskeyRrsig(params: {
  rrsig: RrsigData;
  keys: DnskeyData[];
  ownerName: string;
  now: number;
  // Keys allowed to vouch for the RRset (e.g. only DS-linked ones). The
  // signature is still computed over the full `keys` RRset.
  signers?: DnskeyData[];
}): boolean {
  const { rrsig, keys, ownerName, now, signers } = params;
  const candidateKeys = signers ?? keys;
  if (
    rrsigMetadataIssue({
      rrsig,
      type: 'DNSKEY',
      ownerName,
      signerName: ownerName,
      keys: candidateKeys,
      now,
      // DNSKEY is the zone-apex key set, never a wildcard expansion.
      allowWildcard: false,
    })
  ) {
    return false;
  }

  const candidates = signerCandidates(candidateKeys, rrsig);

  const prefix = rrsigSigningPrefix(rrsig);
  if (!prefix) return false;

  const rrset = uniqueRdata(keys.map((k) => dnskeyRdata(k)))
    .sort(Buffer.compare)
    .map((rdata) =>
      canonicalRr(ownerName, toType('DNSKEY'), rrsig.originalTTL, rdata),
    );

  const signedData = Buffer.concat([prefix, ...rrset]);
  return verifiedByAnyCandidate(candidates, rrsig, signedData);
}

export function verifyRrsetRrsig(params: {
  rrsig: RrsigData;
  type: string;
  records: DnssecAnswerRecord[];
  ownerName: string;
  signerName: string;
  keys: DnskeyData[];
  now: number;
  allowWildcard?: boolean;
}): boolean {
  const {
    rrsig,
    type,
    records,
    ownerName,
    signerName,
    keys,
    now,
    allowWildcard = true,
  } = params;
  if (
    rrsigMetadataIssue({
      rrsig,
      type,
      ownerName,
      signerName,
      keys,
      now,
      allowWildcard,
    })
  ) {
    return false;
  }

  const rrType = toType(type);
  if (!rrType) return false;

  const candidates = signerCandidates(keys, rrsig);

  const prefix = rrsigSigningPrefix(rrsig);
  if (!prefix) return false;

  const signedOwner = canonicalOwnerForRrsig(ownerName, rrsig);
  if (signedOwner === null) return false;
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
  return verifiedByAnyCandidate(candidates, rrsig, signedData);
}
