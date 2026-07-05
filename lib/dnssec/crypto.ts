import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

import {
  EC_COORD_BYTES,
  EC_CURVE_NAME,
  HASH_BY_ALGORITHM,
  RSA_ALGORITHMS,
  rsaKeyParts,
  SUPPORTED_SIGNING_ALGORITHMS,
} from './algorithms';

// Algorithm-specific crypto plumbing: turn a DNSKEY's wire-format public key
// into a node crypto key and verify raw signatures with the right digest and
// signature encoding per algorithm.

/**
 * Turn a DNSKEY's wire-format public key into a node crypto public key, via JWK
 * so no DER hand-encoding is needed. Returns null for unsupported/malformed keys
 * (e.g. Ed448 where the runtime lacks support) -- a null key can never verify,
 * so the zone is treated as unvalidated rather than trusted.
 */
export function dnskeyToPublicKey(
  algorithm: number,
  key: Buffer,
): ReturnType<typeof createPublicKey> | null {
  if (!SUPPORTED_SIGNING_ALGORITHMS.has(algorithm)) return null;
  try {
    if (RSA_ALGORITHMS.has(algorithm)) {
      const parts = rsaKeyParts(key);
      if (!parts) return null;
      return createPublicKey({
        key: {
          kty: 'RSA',
          n: parts.modulus.toString('base64url'),
          e: parts.exponent.toString('base64url'),
        },
        format: 'jwk',
      });
    }
    if (algorithm === 13 || algorithm === 14) {
      const size = EC_COORD_BYTES[algorithm];
      if (key.length !== size * 2) return null;
      return createPublicKey({
        key: {
          kty: 'EC',
          crv: EC_CURVE_NAME[algorithm],
          x: key.subarray(0, size).toString('base64url'),
          y: key.subarray(size).toString('base64url'),
        },
        format: 'jwk',
      });
    }
    if (algorithm === 15 || algorithm === 16) {
      return createPublicKey({
        key: {
          kty: 'OKP',
          crv: algorithm === 15 ? 'Ed25519' : 'Ed448',
          x: key.toString('base64url'),
        },
        format: 'jwk',
      });
    }
  } catch {
    return null;
  }
  return null;
}

export function verifySignature(
  algorithm: number,
  data: Buffer,
  signature: Buffer,
  publicKey: ReturnType<typeof createPublicKey>,
): boolean {
  try {
    // EdDSA is a one-shot verify with no separate hash.
    if (algorithm === 15 || algorithm === 16) {
      return cryptoVerify(null, data, publicKey, signature);
    }
    const hash = HASH_BY_ALGORITHM[algorithm];
    if (!hash) return false;
    // DNSSEC ECDSA signatures are raw r||s (IEEE P1363), not DER-wrapped.
    if (algorithm === 13 || algorithm === 14) {
      return cryptoVerify(
        hash,
        data,
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        signature,
      );
    }
    return cryptoVerify(hash, data, publicKey, signature);
  } catch {
    return false;
  }
}
