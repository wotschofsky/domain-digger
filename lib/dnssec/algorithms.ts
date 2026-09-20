// Algorithm and DS digest names, plus which digests are too weak to count
// as a strong match. Signing-algorithm verify policy lives with the
// signature checker and is not needed for digest-linkage.

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
