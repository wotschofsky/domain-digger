import { describe, expect, it } from 'vitest';

import { RFC_KEY } from './test-vectors';
import { computeKeyTag, dnskeyKeyTag, dnskeyRdata } from './wire';

describe('canonical wire encoding', () => {
  it('computes the RFC 4034 key tag', () => {
    expect(computeKeyTag(dnskeyRdata(RFC_KEY))).toBe(60485);
    expect(dnskeyKeyTag(RFC_KEY)).toBe(60485);
  });

  it('uses the Appendix B.1 exception for RSAMD5', () => {
    const key = {
      flags: 256,
      algorithm: 1,
      key: Buffer.from([0x01, 0xaa, 0xbb, 0xcc]),
    };
    expect(dnskeyKeyTag(key)).toBe(0xaabb);
    expect(dnskeyKeyTag(key)).not.toBe(computeKeyTag(dnskeyRdata(key)));
  });
});
