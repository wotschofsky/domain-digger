// Algorithm registry and policy: which DNSSEC signing algorithms and DS digest
// types exist, which digests are weak, and which signing algorithms this
// validator can actually verify.

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

// DS digest algorithms no longer considered safe: SHA-1 and GOST.
const WEAK_DIGEST_TYPES = new Set([1, 3]);

export const isWeakDigest = (digestType: number): boolean =>
  WEAK_DIGEST_TYPES.has(digestType);

export const RSA_ALGORITHMS = new Set([1, 5, 7, 8, 10]);

// Signing algorithms this validator can actually verify (see crypto.ts). A DS
// pointing at anything else must make the zone insecure, not bogus (RFC 4035
// §5.2). RSAMD5 (1) is excluded: it uses a different key-tag algorithm
// (RFC 4034 App. B.1) and has no verify path here.
export const SUPPORTED_SIGNING_ALGORITHMS = new Set([
  5, 7, 8, 10, 13, 14, 15, 16,
]);

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
