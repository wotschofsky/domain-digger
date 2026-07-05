import { describe, expect, it } from 'vitest';

import { RFC_KEY } from './test-vectors';
import { canonicalRdata, computeKeyTag, dnskeyRdata } from './wire';

describe('canonical wire encoding', () => {
  it('computes the RFC 4034 key tag', () => {
    expect(computeKeyTag(dnskeyRdata(RFC_KEY))).toBe(60485);
  });

  it('canonicalizes supported RDATA without the DNS packet length prefix', () => {
    expect(canonicalRdata('A', '192.0.2.1')?.toString('hex')).toBe('c0000201');
  });
});
