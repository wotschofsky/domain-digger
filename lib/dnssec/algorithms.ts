import type { DnskeyData } from 'dns-packet';

// Algorithm registry and policy: which DNSSEC signing algorithms and DS digest
// types exist, which are deprecated or weak, and which this validator can
// actually verify.

const ALGORITHM_NAMES: Record<number, string> = {
  1: 'RSAMD5',
  3: 'DSA',
  5: 'RSASHA1',
  6: 'DSA-NSEC3-SHA1',
  7: 'RSASHA1-NSEC3-SHA1',
  8: 'RSASHA256',
  10: 'RSASHA512',
  12: 'ECC-GOST',
  13: 'ECDSAP256SHA256',
  14: 'ECDSAP384SHA384',
  15: 'ED25519',
  16: 'ED448',
};

export const algorithmName = (algorithm: number): string =>
  ALGORITHM_NAMES[algorithm] ?? `Algorithm ${algorithm}`;

export const DIGEST_NAMES: Record<number, string> = {
  1: 'SHA-1',
  2: 'SHA-256',
  3: 'GOST R 34.11-94',
  4: 'SHA-384',
};

export const DIGEST_HASH_ALGOS: Record<number, string> = {
  1: 'sha1',
  2: 'sha256',
  4: 'sha384',
};

// Signing algorithms no longer considered safe: RSAMD5, DSA, RSASHA1 (incl.
// the NSEC3 variant), DSA-NSEC3-SHA1, ECC-GOST. RFC 8624 marks these MUST NOT
// / NOT RECOMMENDED for signing.
const DEPRECATED_ALGORITHMS = new Set([1, 3, 5, 6, 7, 12]);

// DS digest algorithms no longer considered safe: SHA-1 and GOST.
const WEAK_DIGEST_TYPES = new Set([1, 3]);

export const RSA_ALGORITHMS = new Set([1, 5, 7, 8, 10]);

// Signing algorithms this validator can actually verify (see
// dnskeyToPublicKey). A DS pointing at anything else must make the zone
// insecure, not bogus (RFC 4035 §5.2). RSAMD5 (1) is excluded: it uses a
// different key-tag algorithm (RFC 4034 App. B.1) and has no verify path here.
export const SUPPORTED_SIGNING_ALGORITHMS = new Set([
  5, 7, 8, 10, 13, 14, 15, 16,
]);

// Security parameter (in bits) for the fixed-size elliptic-curve / EdDSA
// algorithms, keyed by DNSSEC algorithm number.
const CURVE_BITS: Record<number, number> = {
  13: 256, // ECDSA P-256
  14: 384, // ECDSA P-384
  15: 256, // Ed25519
  16: 456, // Ed448
};

// Digest used by each signing algorithm's RRSIG (EdDSA hashes internally).
export const HASH_BY_ALGORITHM: Record<number, string> = {
  5: 'sha1', // RSASHA1
  7: 'sha1', // RSASHA1-NSEC3-SHA1
  8: 'sha256', // RSASHA256
  10: 'sha512', // RSASHA512
  13: 'sha256', // ECDSAP256SHA256
  14: 'sha384', // ECDSAP384SHA384
};

export const EC_CURVE_NAME: Record<number, string> = {
  13: 'P-256',
  14: 'P-384',
};
export const EC_COORD_BYTES: Record<number, number> = { 13: 32, 14: 48 };

export const isDeprecatedAlgorithm = (algorithm: number): boolean =>
  DEPRECATED_ALGORITHMS.has(algorithm);

export const isWeakDigest = (digestType: number): boolean =>
  WEAK_DIGEST_TYPES.has(digestType);

/** Split an RFC 3110 RSA public key into its exponent and modulus. */
export const rsaKeyParts = (
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
 * Key strength in bits. For RSA this is the modulus length parsed from the
 * RFC 3110 public-key wire format (1-byte exponent length, or 0 + 2-byte length
 * for long exponents, then exponent, then modulus). For ECDSA/EdDSA it is the
 * curve's security parameter. Null for unknown algorithms.
 */
export const keyBits = (
  key: Pick<DnskeyData, 'algorithm' | 'key'>,
): number | null => {
  if (key.algorithm in CURVE_BITS) return CURVE_BITS[key.algorithm];
  if (!RSA_ALGORITHMS.has(key.algorithm)) return null;

  const parts = rsaKeyParts(key.key);
  return parts ? parts.modulus.length * 8 : null;
};
