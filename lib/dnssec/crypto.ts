import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

import type { DnskeyData } from 'dns-packet';

import {
  RSA_ALGORITHMS,
  rsaKeyParts,
  SUPPORTED_SIGNING_ALGORITHMS,
} from './algorithms';

// Algorithm-specific crypto plumbing: turn a DNSKEY's wire-format public key
// into a node crypto key and verify a raw signature with the right digest and
// signature encoding for its algorithm.

// Digest used by each signing algorithm's RRSIG (EdDSA hashes internally).
const HASH_BY_ALGORITHM: Record<number, string> = {
  5: 'sha1', // RSASHA1
  7: 'sha1', // RSASHA1-NSEC3-SHA1
  8: 'sha256', // RSASHA256
  10: 'sha512', // RSASHA512
  13: 'sha256', // ECDSAP256SHA256
  14: 'sha384', // ECDSAP384SHA384
};

const EC_CURVES: Record<number, { name: string; coordBytes: number }> = {
  13: { name: 'P-256', coordBytes: 32 },
  14: { name: 'P-384', coordBytes: 48 },
};

const EDDSA_CURVES: Record<number, string> = { 15: 'Ed25519', 16: 'Ed448' };

/**
 * A DNSKEY's public key as a JWK, so no DER hand-encoding is needed. Null for
 * an algorithm outside SUPPORTED_SIGNING_ALGORITHMS and for key material that
 * is malformed for its algorithm.
 */
const dnskeyJwk = ({
  algorithm,
  key,
}: Pick<DnskeyData, 'algorithm' | 'key'>): Record<string, string> | null => {
  if (!SUPPORTED_SIGNING_ALGORITHMS.has(algorithm)) return null;
  if (RSA_ALGORITHMS.has(algorithm)) {
    const parts = rsaKeyParts(key);
    return (
      parts && {
        kty: 'RSA',
        n: parts.modulus.toString('base64url'),
        e: parts.exponent.toString('base64url'),
      }
    );
  }
  const curve = EC_CURVES[algorithm];
  if (curve) {
    if (key.length !== curve.coordBytes * 2) return null;
    return {
      kty: 'EC',
      crv: curve.name,
      x: key.subarray(0, curve.coordBytes).toString('base64url'),
      y: key.subarray(curve.coordBytes).toString('base64url'),
    };
  }
  const eddsa = EDDSA_CURVES[algorithm];
  return eddsa
    ? { kty: 'OKP', crv: eddsa, x: key.toString('base64url') }
    : null;
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
  const { algorithm } = dnskey;
  try {
    const jwk = dnskeyJwk(dnskey);
    if (!jwk) return false;
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    // EdDSA is a one-shot verify with no separate hash.
    if (algorithm in EDDSA_CURVES) {
      return cryptoVerify(null, data, publicKey, signature);
    }
    const hash = HASH_BY_ALGORITHM[algorithm];
    if (!hash) return false;
    // DNSSEC ECDSA signatures are raw r||s (IEEE P1363), not DER-wrapped.
    return cryptoVerify(
      hash,
      data,
      algorithm in EC_CURVES
        ? { key: publicKey, dsaEncoding: 'ieee-p1363' }
        : publicKey,
      signature,
    );
  } catch {
    return false;
  }
};
