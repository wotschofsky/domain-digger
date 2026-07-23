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

  it('encodes DNSKEY RDATA through its explicit canonical path', () => {
    expect(canonicalRdata('DNSKEY', RFC_KEY)).toEqual(dnskeyRdata(RFC_KEY));
  });

  it('lowercases domain names embedded in structured RDATA', () => {
    expect(canonicalRdata('NS', 'Ns1.Example.COM.')).toEqual(
      canonicalRdata('NS', 'ns1.example.com'),
    );
    expect(
      canonicalRdata('MX', { preference: 10, exchange: 'MAIL.Example.' }),
    ).toEqual(
      canonicalRdata('MX', {
        preference: 10,
        exchange: 'mail.example',
      }),
    );
  });

  it('rejects opaque name-bearing RDATA that cannot be canonicalized safely', () => {
    expect(canonicalRdata('KX', Buffer.from('opaque'))).toBeNull();
  });
});
