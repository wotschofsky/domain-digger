import { describe, expect, it } from 'vitest';

import { dsDigest, dsMatchesKey } from './ds';
import { RFC_DS, RFC_KEY } from './test-vectors';
import { computeKeyTag, dnskeyRdata } from './wire';

describe('DS digest linkage', () => {
  it('computes the RFC 4034 DS digest (SHA-1)', () => {
    expect(
      dsDigest('dskey.example.com', RFC_KEY, 1)?.toString('hex').toUpperCase(),
    ).toBe('2BB183AF5F22588179A53B0A98631FAD1A292118');
  });

  it('matches a DS to its DNSKEY', () => {
    expect(dsMatchesKey(RFC_DS, RFC_KEY, 'dskey.example.com')).toBe(true);
  });

  it('rejects a DS for the wrong owner name', () => {
    expect(dsMatchesKey(RFC_DS, RFC_KEY, 'other.example.com')).toBe(false);
  });

  it('returns null for an unsupported digest type', () => {
    expect(dsDigest('dskey.example.com', RFC_KEY, 99)).toBeNull();
  });

  it('rejects a DS whose key tag does not match the DNSKEY', () => {
    // Correct digest + algorithm but a deliberately wrong key tag: a validator
    // would never select this key, so it must not count as a match.
    const good = {
      ...RFC_DS,
      keyTag: computeKeyTag(dnskeyRdata(RFC_KEY)),
      digest: dsDigest('example', RFC_KEY, 1)!,
    };
    const tagMismatch = { ...good, keyTag: good.keyTag + 1 };
    expect(dsMatchesKey(tagMismatch, RFC_KEY, 'example')).toBe(false);
  });
});
