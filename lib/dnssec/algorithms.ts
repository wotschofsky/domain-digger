import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

import type { DnskeyData } from 'dns-packet';

// Algorithm registry: the DNSSEC signing algorithms and DS digest types this
// lookup knows, with what it can do with each. One row per algorithm, so
// whether an algorithm is supported can never drift from whether it can be
// verified.

// How to turn a DNSKEY's wire-format public key into a node crypto key and
// verify an RRSIG with it (EdDSA hashes internally).
type Verifier =
  | { kty: 'RSA'; hash: string }
  | { kty: 'EC'; hash: string; crv: string; coordBytes: number }
  | { kty: 'OKP'; crv: string };

// Algorithms without a verifier cannot be validated here: a DS pointing at
// one must make the zone insecure, not bogus (RFC 4035 §5.2). RSAMD5 has
// none: validators must not validate it (RFC 8624 §3.1).
const SIGNING: Record<number, { name: string; verifier?: Verifier }> = {
  1: { name: 'RSAMD5' },
  3: { name: 'DSA' },
  5: { name: 'RSASHA1', verifier: { kty: 'RSA', hash: 'sha1' } },
  6: { name: 'DSA-NSEC3-SHA1' },
  7: { name: 'RSASHA1-NSEC3-SHA1', verifier: { kty: 'RSA', hash: 'sha1' } },
  8: { name: 'RSASHA256', verifier: { kty: 'RSA', hash: 'sha256' } },
  10: { name: 'RSASHA512', verifier: { kty: 'RSA', hash: 'sha512' } },
  12: { name: 'ECC-GOST' },
  13: {
    name: 'ECDSAP256SHA256',
    verifier: { kty: 'EC', hash: 'sha256', crv: 'P-256', coordBytes: 32 },
  },
  14: {
    name: 'ECDSAP384SHA384',
    verifier: { kty: 'EC', hash: 'sha384', crv: 'P-384', coordBytes: 48 },
  },
  15: { name: 'ED25519', verifier: { kty: 'OKP', crv: 'Ed25519' } },
  16: { name: 'ED448', verifier: { kty: 'OKP', crv: 'Ed448' } },
};

// `hash` is absent for digest types this validator cannot compute. SHA-1 and
// GOST are no longer considered safe.
const DIGESTS: Record<number, { name: string; hash?: string; weak?: true }> = {
  1: { name: 'SHA-1', hash: 'sha1', weak: true },
  2: { name: 'SHA-256', hash: 'sha256' },
  3: { name: 'GOST R 34.11-94', weak: true },
  4: { name: 'SHA-384', hash: 'sha384' },
};

export const algorithmName = (algorithm: number): string =>
  SIGNING[algorithm]?.name ?? `Algorithm ${algorithm}`;

export const isSupportedSigningAlgorithm = (algorithm: number): boolean =>
  Boolean(SIGNING[algorithm]?.verifier);

export const digestName = (digestType: number): string =>
  DIGESTS[digestType]?.name ?? `Digest ${digestType}`;

/** Node hash name for a DS digest type; undefined if unsupported. */
export const digestHash = (digestType: number): string | undefined =>
  DIGESTS[digestType]?.hash;

export const isWeakDigest = (digestType: number): boolean =>
  Boolean(DIGESTS[digestType]?.weak);

/** Split an RFC 3110 RSA public key into its exponent and modulus. */
const rsaKeyParts = (
  key: Buffer,
): { exponent: Buffer; modulus: Buffer } | null => {
  if (key.length < 1) return null;
  let offset: number;
  let expLen = key[0];
  if (expLen === 0) {
    if (key.length < 3) return null;
    expLen = key.readUInt16BE(1);
    offset = 3;
  } else {
    offset = 1;
  }
  const exponent = key.subarray(offset, offset + expLen);
  const modulus = key.subarray(offset + expLen);
  if (exponent.length === 0 || modulus.length === 0) return null;
  return { exponent, modulus };
};

/**
 * A DNSKEY's public key as a JWK, so no DER hand-encoding is needed. Null for
 * key material that is malformed for its algorithm.
 */
const dnskeyJwk = (
  verifier: Verifier,
  key: Buffer,
): Record<string, string> | null => {
  switch (verifier.kty) {
    case 'RSA': {
      const parts = rsaKeyParts(key);
      return (
        parts && {
          kty: 'RSA',
          n: parts.modulus.toString('base64url'),
          e: parts.exponent.toString('base64url'),
        }
      );
    }
    case 'EC':
      if (key.length !== verifier.coordBytes * 2) return null;
      return {
        kty: 'EC',
        crv: verifier.crv,
        x: key.subarray(0, verifier.coordBytes).toString('base64url'),
        y: key.subarray(verifier.coordBytes).toString('base64url'),
      };
    case 'OKP':
      return { kty: 'OKP', crv: verifier.crv, x: key.toString('base64url') };
  }
};

/**
 * Whether `signature` over `data` was made by the private half of `dnskey`.
 * False -- never a throw -- for an unsupported algorithm (classified
 * unvalidatable upstream, RFC 4035 §5.2) and for a malformed key of a
 * supported one: that key is genuinely unusable, so it can never verify and
 * the data it was meant to sign reads as bogus.
 */
export const verifyWithDnskey = (
  dnskey: Pick<DnskeyData, 'algorithm' | 'key'>,
  data: Buffer,
  signature: Buffer,
): boolean => {
  const verifier = SIGNING[dnskey.algorithm]?.verifier;
  if (!verifier) return false;
  try {
    const jwk = dnskeyJwk(verifier, dnskey.key);
    if (!jwk) return false;
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    switch (verifier.kty) {
      // EdDSA is a one-shot verify with no separate hash.
      case 'OKP':
        return cryptoVerify(null, data, publicKey, signature);
      // DNSSEC ECDSA signatures are raw r||s (IEEE P1363), not DER-wrapped.
      case 'EC':
        return cryptoVerify(
          verifier.hash,
          data,
          { key: publicKey, dsaEncoding: 'ieee-p1363' },
          signature,
        );
      case 'RSA':
        return cryptoVerify(verifier.hash, data, publicKey, signature);
    }
  } catch {
    return false;
  }
};
