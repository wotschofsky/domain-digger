import type { DnskeyData, DsData } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import {
  buildChain,
  computeKeyTag,
  dnskeyRdata,
  dsDigest,
  dsMatchesKey,
  type RawZone,
  ROOT_TRUST_ANCHORS,
} from './dnssec';

// RFC 4034 Appendix B worked example: dskey.example.com.
const RFC_KEY: DnskeyData = {
  flags: 256,
  algorithm: 5, // RSASHA1
  key: Buffer.from(
    'AQOeiiR0GOMYkDshWoSKz9XzfwJr1AYtsmx3TGkJaNXVbfi/2pHm822aJ5iI9BMz' +
      'NXxeYCmZDRD99WYwYqUSdjMmmAphXdvxegXd/M5+X7OrzKBaMbCVdFLUUh6DhweJ' +
      'BjEVv5f2wwjM9XzcnOf+EPbtG9DMBmADjFDc2w/rljwvFw==',
    'base64',
  ),
};
const RFC_DS: DsData = {
  keyTag: 60485,
  algorithm: 5,
  digestType: 1, // SHA-1
  digest: Buffer.from('2BB183AF5F22588179A53B0A98631FAD1A292118', 'hex'),
};

describe('dnssec crypto primitives', () => {
  it('computes the RFC 4034 key tag', () => {
    expect(computeKeyTag(dnskeyRdata(RFC_KEY))).toBe(60485);
  });

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
});

describe('buildChain', () => {
  const sep: DnskeyData = { ...RFC_KEY, flags: 257 }; // SEP/KSK bit set

  // DS records that authenticate `sep` at a given owner name. The first zone in
  // these chains is non-root, so its dsRecords act as the (trusted) parent DS --
  // letting us exercise the secure path without forging the real root KSK.
  const dsFor = (name: string): DsData => ({
    ...RFC_DS,
    keyTag: computeKeyTag(dnskeyRdata(sep)),
    digest: dsDigest(name, sep, 1)!,
  });

  it('marks a fully linked chain secure', () => {
    const zones: RawZone[] = [
      { name: 'example', keys: [sep], dsRecords: [dsFor('example')] },
      {
        name: 'child.example',
        keys: [sep],
        dsRecords: [dsFor('child.example')],
      },
    ];
    const chain = buildChain(zones);
    expect(chain.zones.map((z) => z.status)).toEqual(['secure', 'secure']);
    expect(chain.overall).toBe('secure');
  });

  it('enforces the real root trust anchor (fake root key -> broken)', () => {
    const chain = buildChain([{ name: '.', keys: [sep], dsRecords: [] }]);
    expect(chain.zones[0].status).toBe('broken');
    expect(chain.overall).toBe('broken');
  });

  it('marks an unsigned zone insecure and propagates', () => {
    const zones: RawZone[] = [
      { name: 'example', keys: [], dsRecords: [] },
      { name: 'child.example', keys: [sep], dsRecords: [] },
    ];
    const chain = buildChain(zones);
    expect(chain.zones[0].status).toBe('insecure');
    expect(chain.overall).toBe('insecure');
  });

  it('marks a DS-without-DNSKEY zone as broken (not insecure)', () => {
    const zones: RawZone[] = [
      { name: 'example', keys: [], dsRecords: [dsFor('example')] },
    ];
    const chain = buildChain(zones);
    expect(chain.zones[0].status).toBe('broken');
    expect(chain.overall).toBe('broken');
  });

  it('marks a DS that matches no key as broken', () => {
    const wrongDs: DsData = { ...RFC_DS, digest: Buffer.alloc(20, 0xaa) };
    const zones: RawZone[] = [
      { name: 'example', keys: [sep], dsRecords: [wrongDs] },
    ];
    const chain = buildChain(zones);
    expect(chain.zones[0].status).toBe('broken');
    expect(chain.overall).toBe('broken');
  });

  it('flags the root anchor and KSK metadata', () => {
    const chain = buildChain([{ name: '.', keys: [sep], dsRecords: [] }]);
    expect(chain.zones[0].displayName).toBe('root');
    expect(chain.zones[0].keys[0].isSep).toBe(true);
    expect(chain.zones[0].dsRecords).toHaveLength(ROOT_TRUST_ANCHORS.length);
  });
});
