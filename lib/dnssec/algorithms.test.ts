import { describe, expect, it } from 'vitest';

import {
  algorithmName,
  digestName,
  isSupportedSigningAlgorithm,
  isWeakDigest,
  verifyWithDnskey,
} from './algorithms';
import { genKey, signData } from './test-helpers';

describe('algorithm registry', () => {
  it('names known algorithms and digests and falls back for unknown ones', () => {
    expect(algorithmName(8)).toBe('RSASHA256');
    expect(algorithmName(99)).toBe('Algorithm 99');
    expect(digestName(2)).toBe('SHA-256');
    expect(digestName(99)).toBe('Digest 99');
  });

  it('flags weak digests', () => {
    expect(isWeakDigest(1)).toBe(true); // SHA-1
    expect(isWeakDigest(2)).toBe(false); // SHA-256
    expect(isWeakDigest(3)).toBe(true); // GOST
  });

  it('supports exactly the signing algorithms it can verify', () => {
    expect(isSupportedSigningAlgorithm(8)).toBe(true);
    expect(isSupportedSigningAlgorithm(1)).toBe(false); // RSAMD5
    expect(isSupportedSigningAlgorithm(3)).toBe(false); // DSA
  });
});

// Real-world keys and signatures are covered by the golden vectors in
// rrsig.test.ts; this pins the per-algorithm plumbing and its failure modes.
describe('verifyWithDnskey', () => {
  const data = Buffer.from('canonical signed data');

  it('verifies RSA, ECDSA, and Ed25519 signatures', () => {
    for (const algorithm of [8, 13, 15]) {
      const signer = genKey(algorithm);
      const signature = signData(signer, data);

      expect(verifyWithDnskey(signer.dnskey, data, signature)).toBe(true);
      expect(
        verifyWithDnskey(signer.dnskey, Buffer.from('other data'), signature),
      ).toBe(false);
    }
  });

  it('rejects unknown algorithms and malformed keys instead of throwing', () => {
    const signer = genKey(13);
    const signature = signData(signer, data);
    const verifyWith = (algorithm: number, key: Buffer) =>
      verifyWithDnskey({ algorithm, key }, data, signature);

    expect(verifyWith(99, signer.dnskey.key)).toBe(false); // unknown alg
    expect(verifyWith(13, Buffer.alloc(10))).toBe(false); // wrong EC size
    expect(verifyWith(8, Buffer.alloc(0))).toBe(false); // empty RSA
  });
});
