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
  if (rrsig.typeCovered !== 'DNSKEY') return false;
  // The signer of a zone's DNSKEY RRset must be the zone itself (RFC 4035
  // §5.3.1) -- validating resolvers reject a wrong Signer's Name even when the
  // signature bytes verify.
  if (normalizeDomain(rrsig.signersName) !== normalizeDomain(ownerName)) {
    return false;
  }
  if (now < rrsig.inception || now > rrsig.expiration) return false;

  const candidates = signerCandidates(signers ?? keys, rrsig);
  if (!candidates.length) return false;

  const prefix = rrsigSigningPrefix(rrsig);
  if (!prefix) return false;

  const rrset = keys
    .map((k) => dnskeyRdata(k))
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
}): boolean {
  const { rrsig, type, records, ownerName, signerName, keys, now } = params;
  if (rrsig.typeCovered !== type) return false;
  if (normalizeDomain(rrsig.signersName) !== normalizeDomain(signerName)) {
    return false;
  }
  if (now < rrsig.inception || now > rrsig.expiration) return false;

  const rrType = toType(type);
  if (!rrType) return false;

  const candidates = signerCandidates(keys, rrsig);
  if (!candidates.length) return false;

  const prefix = rrsigSigningPrefix(rrsig);
  if (!prefix) return false;

  const signedOwner = canonicalOwnerForRrsig(ownerName, rrsig);
  const rrset = records
    .filter((record) => record.type === type)
    .map((record) => canonicalRdata(type, record.data))
    .filter((rdata): rdata is Buffer => rdata !== null)
    .sort(Buffer.compare)
    .map((rdata) => canonicalRr(signedOwner, rrType, rrsig.originalTTL, rdata));

  if (
    rrset.length !== records.filter((record) => record.type === type).length
  ) {
    return false;
  }

  const signedData = Buffer.concat([prefix, ...rrset]);
  return verifiedByAnyCandidate(candidates, rrsig, signedData);
}
