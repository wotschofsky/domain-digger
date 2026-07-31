import { describe, expect, it } from 'vitest';

import { isDeprecatedAlgorithm, isWeakDigest, keyBits } from './algorithms';
import { RFC_KEY } from './test-vectors';

describe('algorithm policy', () => {
  it('parses the RSA modulus length in bits', () => {
    // The RFC 4034 dskey.example.com key is a 1024-bit RSA key.
    expect(keyBits(RFC_KEY)).toBe(1024);
  });

  it('reports curve size for ECDSA/EdDSA keys', () => {
    expect(keyBits({ algorithm: 13, key: Buffer.alloc(64) })).toBe(256);
    expect(keyBits({ algorithm: 15, key: Buffer.alloc(32) })).toBe(256);
    expect(keyBits({ algorithm: 99, key: Buffer.alloc(10) })).toBeNull();
  });

  it('flags deprecated algorithms and weak digests', () => {
    expect(isDeprecatedAlgorithm(5)).toBe(true); // RSASHA1
    expect(isDeprecatedAlgorithm(13)).toBe(false); // ECDSAP256SHA256
    expect(isWeakDigest(1)).toBe(true); // SHA-1
    expect(isWeakDigest(2)).toBe(false); // SHA-256
  });
});
