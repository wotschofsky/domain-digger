import { describe, expect, it } from 'vitest';

import { rrsetResult } from './rrset';
import type { DnssecChainResult, DnssecRrset, DnssecZone } from './types';
import { chainVerdict } from './verdict';

const zone = (over: Partial<DnssecZone> = {}): DnssecZone =>
  ({
    name: 'example.com',
    status: 'secure',
    inherited: false,
    keys: [],
    dsRecords: [],
    ...over,
  }) as DnssecZone;

const secure = (rrsets?: DnssecRrset[]): DnssecChainResult => ({
  status: 'secure',
  zones: [zone({ name: '.' }), zone({ rrsets })],
});

describe('chainVerdict', () => {
  it('has nothing to say about an empty chain', () => {
    expect(
      chainVerdict({ status: 'insecure', zones: [] }, 'not-checked'),
    ).toEqual({ kind: 'unknown' });
  });

  it('leads an authenticated chain with the unproved NXDOMAIN', () => {
    expect(chainVerdict(secure(), 'unproved-nxdomain')).toEqual({
      kind: 'nxdomain-unproved',
    });
  });

  it('leads an unregistered name with NXDOMAIN, not unsigned-delegation advice', () => {
    // A name that does not exist has no DS of its own, which otherwise reads
    // as an unsigned delegation and advises publishing a DS for it.
    const chain: DnssecChainResult = {
      status: 'insecure',
      breakAt: 1,
      zones: [zone({ name: '.' }), zone({ status: 'insecure' })],
    };

    expect(chainVerdict(chain, 'unproved-nxdomain')).toEqual({
      kind: 'nxdomain-unproved',
    });
  });

  it('leads a bogus chain with the break, not the NXDOMAIN it served', () => {
    // An NXDOMAIN served under a broken link is itself untrustworthy.
    const chain: DnssecChainResult = {
      status: 'broken',
      breakAt: 1,
      zones: [
        zone({ name: '.' }),
        zone({ status: 'broken', breakReason: 'ds-mismatch' }),
      ],
    };

    expect(chainVerdict(chain, 'unproved-nxdomain')).toEqual({
      kind: 'break',
      reason: 'ds-mismatch',
    });
  });

  it('distinguishes an unproved NODATA from a positive secure result', () => {
    expect(chainVerdict(secure(), 'unproved-nodata')).toEqual({
      kind: 'secure-nodata',
    });
  });

  it('ranks RRset problems above RRsets it could not check', () => {
    const rrsets = [
      rrsetResult('lookup-failed', { type: 'MX', recordCount: 0 }),
      rrsetResult('missing-rrsig', { type: 'TXT', recordCount: 1 }),
    ];

    expect(chainVerdict(secure(rrsets), 'positive')).toEqual({
      kind: 'secure-rrset-problems',
      rrsetTypes: ['TXT'],
    });
  });

  it('reports unchecked RRsets when nothing is actually wrong', () => {
    const rrsets = [
      rrsetResult('validated', { type: 'A', recordCount: 1 }),
      rrsetResult('lookup-failed', { type: 'MX', recordCount: 0 }),
    ];

    expect(chainVerdict(secure(rrsets), 'positive')).toEqual({
      kind: 'secure-rrset-unchecked',
      rrsetTypes: ['MX'],
    });
  });

  it('counts only the validated RRsets, ignoring absent ones', () => {
    const rrsets = [
      rrsetResult('validated', { type: 'A', recordCount: 1 }),
      rrsetResult('validated', { type: 'NS', recordCount: 2 }),
      rrsetResult('no-records', { type: 'CAA', recordCount: 0 }),
    ];

    expect(chainVerdict(secure(rrsets), 'positive')).toEqual({
      kind: 'secure-validated',
      validatedRrsetCount: 2,
    });
  });

  it('falls back to a plain secure verdict with no leaf RRsets', () => {
    expect(chainVerdict(secure(), 'not-checked')).toEqual({ kind: 'secure' });
  });

  it('marks an unsigned cut at the queried name so it can be remediated', () => {
    const chain: DnssecChainResult = {
      status: 'insecure',
      breakAt: 1,
      zones: [zone({ name: '.' }), zone({ status: 'insecure' })],
    };

    expect(chainVerdict(chain, 'positive')).toEqual({
      kind: 'unsigned-cut',
      atLeaf: true,
    });
  });

  it('does not offer remediation for an unsigned cut above the queried name', () => {
    const chain: DnssecChainResult = {
      status: 'insecure',
      breakAt: 1,
      zones: [
        zone({ name: '.' }),
        zone({ name: 'example.com', status: 'insecure' }),
        zone({
          name: 'www.example.com',
          status: 'insecure',
          inherited: true,
        }),
      ],
    };

    expect(chainVerdict(chain, 'positive')).toEqual({
      kind: 'unsigned-cut',
      atLeaf: false,
    });
  });

  it('reports a break zone that serves keys but has no authenticated DS', () => {
    const chain: DnssecChainResult = {
      status: 'insecure',
      breakAt: 1,
      zones: [
        zone({ name: '.' }),
        zone({
          status: 'insecure',
          keys: [{ keyTag: 1 } as DnssecZone['keys'][number]],
        }),
      ],
    };

    expect(chainVerdict(chain, 'positive')).toEqual({
      kind: 'no-authenticated-ds',
    });
  });
});
