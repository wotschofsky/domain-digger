import { describe, expect, it } from 'vitest';

import type { DnssecChain } from '@/lib/dnssec';

import {
  relativeTime,
  signatureExpiryTone,
  verdictPresentation,
} from './chain-diagram';

const secureChain = (
  observation: DnssecChain['query']['observation'],
): DnssecChain => ({
  status: 'secure',
  zones: [
    {
      name: 'example.com',
      status: 'secure',
      keys: [],
      dsRecords: [],
      rrsets: [],
    },
  ],
  coverage: {
    delegationDsRrsets: 'validated-along-secure-path',
    dnskeyRrsets: 'validated',
    positiveRrsets: 'common-types-only',
    checkedPositiveRrsetTypes: [],
    negativeProofs: 'not-implemented',
    unsignedSubdelegations: 'not-implemented',
    cnameTargets: 'not-checked',
  },
  query: { name: 'missing.example.com', observation },
});

describe('DNSSEC verdict presentation', () => {
  it('does not render an unproved NXDOMAIN as a plain secure verdict', () => {
    const presentation = verdictPresentation(secureChain('unproved-nxdomain'));

    expect(presentation.title).toBe('NXDOMAIN observed — not proven');
    expect(presentation.body).toContain('nonexistence is not authenticated');
  });

  it('distinguishes unproved NODATA from a positive secure result', () => {
    const presentation = verdictPresentation(secureChain('unproved-nodata'));

    expect(presentation.title).toBe('Secure chain, no records observed');
    expect(presentation.body).toContain('absence is not authenticated');
  });

  it('points parent-side DS signature remediation at the parent operator', () => {
    const chain = secureChain('positive');
    chain.status = 'broken';
    chain.zones[0] = {
      ...chain.zones[0],
      status: 'broken',
      breakReason: 'bad-ds-signature',
    };

    expect(verdictPresentation(chain).remediation).toBe(
      'To fix: the operator of the parent zone must restore a valid signature over the DS record set.',
    );
  });
});

describe('DNSSEC signature freshness presentation', () => {
  it('uses seconds instead of rounding a near-term expiry to zero minutes', () => {
    expect(relativeTime(20)).toBe('in 20 seconds');
  });

  it('reserves the broken tone for signatures that have expired', () => {
    expect(signatureExpiryTone(-1)).toBe('broken');
    expect(signatureExpiryTone(20)).toBe('warn');
    expect(signatureExpiryTone(8 * 86400)).toBe('muted');
  });
});
