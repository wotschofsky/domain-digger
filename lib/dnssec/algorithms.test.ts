import { describe, expect, it } from 'vitest';

import { algorithmName, isWeakDigest } from './algorithms';

describe('algorithm policy', () => {
  it('names known algorithms and falls back for unknown ones', () => {
    expect(algorithmName(8)).toBe('RSASHA256');
    expect(algorithmName(99)).toBe('Algorithm 99');
  });

  it('flags weak digests', () => {
    expect(isWeakDigest(1)).toBe(true); // SHA-1
    expect(isWeakDigest(2)).toBe(false); // SHA-256
    expect(isWeakDigest(3)).toBe(true); // GOST
  });
});
