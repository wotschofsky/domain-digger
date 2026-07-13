import { describe, expect, it } from 'vitest';

import type { DnssecChain } from '@/lib/dnssec';

import { verdictPresentation } from './chain-diagram';

const secureChain = (observation: DnssecChain['query']['observation']) =>
  ({
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
  }) satisfies DnssecChain;

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
});
