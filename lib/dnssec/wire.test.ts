import { describe, expect, it } from 'vitest';

import { RFC_KEY } from './test-vectors';
import { computeKeyTag, dnskeyRdata } from './wire';

describe('canonical wire encoding', () => {
  it('computes the RFC 4034 key tag', () => {
    expect(computeKeyTag(dnskeyRdata(RFC_KEY))).toBe(60485);
  });
});
