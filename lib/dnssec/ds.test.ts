import type { DnskeyData } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import { dsDigest, linkKeys } from './ds';
import { RFC_DS, RFC_KEY } from './test-vectors';
import { dnskeyKeyTag } from './wire';

const ZONE = 'dskey.example.com';

// A DS for `key` at ZONE, optionally with a zeroed (non-matching) digest.
const dsFor = (digestType: number, key = RFC_KEY, corrupt = false) => {
  // Digest types without a hash here (e.g. 3, GOST) get a SHA-256 stand-in.
  const digest = dsDigest(ZONE, key, digestType) ?? dsDigest(ZONE, key, 2)!;
  return {
    keyTag: dnskeyKeyTag(key),
    algorithm: key.algorithm,
    digestType,
    digest: corrupt ? Buffer.alloc(digest.length) : digest,
  };
};

describe('DS digest linkage', () => {
  it('computes the RFC 4034 DS digest (SHA-1)', () => {
    expect(dsDigest(ZONE, RFC_KEY, 1)?.toString('hex').toUpperCase()).toBe(
      '2BB183AF5F22588179A53B0A98631FAD1A292118',
    );
  });

  it('returns null for an unsupported digest type', () => {
    expect(dsDigest(ZONE, RFC_KEY, 99)).toBeNull();
  });

  it('links a DS to its DNSKEY', () => {
    expect(linkKeys(ZONE, [RFC_DS], [RFC_KEY])).toEqual({
      status: 'linked',
      linkedKeys: [RFC_KEY],
      matched: [true],
    });
  });

  it('rejects a DS for the wrong owner name', () => {
    expect(linkKeys('other.example.com', [RFC_DS], [RFC_KEY])).toMatchObject({
      status: 'mismatch',
      matched: [false],
    });
  });

  it('matches an RSAMD5 DS by the Appendix B.1 key tag only', () => {
    const key = {
      flags: 256,
      algorithm: 1,
      key: Buffer.from([0x01, 0xaa, 0xbb, 0xcc]),
    };
    const ds = {
      keyTag: 0xaabb,
      algorithm: 1,
      digestType: 1,
      digest: dsDigest('example.com', key, 1)!,
    };
    expect(linkKeys('example.com', [ds], [key]).matched).toEqual([true]);
    // 0xc177: the general-case checksum, which RSAMD5 does not use.
    expect(
      linkKeys('example.com', [{ ...ds, keyTag: 0xc177 }], [key]).matched,
    ).toEqual([false]);
  });

  it('rejects a DNSKEY without the Zone Key flag', () => {
    const key = { ...RFC_KEY, flags: RFC_KEY.flags & ~0x0100 };
    expect(linkKeys(ZONE, [RFC_DS], [key]).status).toBe('mismatch');
  });

  it('rejects a DS whose key tag does not match the DNSKEY', () => {
    // Correct digest + algorithm but a deliberately wrong key tag: a validator
    // would never select this key, so it must not count as a match.
    const ds = dsFor(1);
    expect(
      linkKeys(ZONE, [{ ...ds, keyTag: ds.keyTag + 1 }], [RFC_KEY]).status,
    ).toBe('mismatch');
  });

  it('ignores SHA-1 next to a stronger digest', () => {
    const link = (...ds: ReturnType<typeof dsFor>[]) =>
      linkKeys(ZONE, ds, [RFC_KEY]);

    expect(link(dsFor(2), dsFor(1, RFC_KEY, true))).toMatchObject({
      status: 'linked',
      matched: [true, false],
    });
    expect(link(dsFor(1), dsFor(2, RFC_KEY, true)).status).toBe('mismatch');
    expect(link(dsFor(1), dsFor(4, RFC_KEY, true)).status).toBe('mismatch');
    expect(link(dsFor(2, RFC_KEY, true), dsFor(4)).status).toBe('linked');
  });

  it('treats a DS set with only unsupported digests as unsigned', () => {
    expect(linkKeys(ZONE, [dsFor(3)], [RFC_KEY]).status).toBe('unsigned');
  });

  it('treats a DS for an unsupported signing algorithm as unsigned', () => {
    // DSA (3): the digest links, but no signature by it can be verified.
    const dsa: DnskeyData = { flags: 257, algorithm: 3, key: Buffer.alloc(64) };
    expect(linkKeys(ZONE, [dsFor(2, dsa)], [dsa])).toEqual({
      status: 'unsigned',
      linkedKeys: [],
      matched: [true],
    });
  });
});
