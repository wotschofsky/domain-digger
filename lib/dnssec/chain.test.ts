import type { DnskeyData, DsData } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import { buildChain as buildDnssecChain, ROOT_TRUST_ANCHORS } from './chain';
import { dsDigest } from './ds';
import { dsForKey, genKey, signDnskeyRrset, signDsRrset } from './test-helpers';
import { RFC_DS, RFC_KEY } from './test-vectors';
import type { RawZone } from './types';
import { computeKeyTag, dnskeyRdata } from './wire';

const buildChain = (zones: RawZone[], now?: number) =>
  buildDnssecChain(zones, now, {
    initialTrustAnchors:
      zones[0] && zones[0].name !== '.' ? zones[0].dsRecords : undefined,
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

  it('does not trust a non-root first zone without an explicit trust anchor', () => {
    const key = genKey(13);
    const zone: RawZone = {
      name: 'example',
      keys: [key.dnskey],
      dsRecords: [dsForKey('example', key.dnskey)],
      keyRrsigs: [
        signDnskeyRrset('example', [key.dnskey], key, {
          inception: 1000,
          expiration: 2000,
        }),
      ],
    };

    expect(buildDnssecChain([zone], 1500).status).toBe('insecure');
  });

  it('marks a fully linked, validly-signed chain secure', () => {
    // Real signatures required now: each zone's DNSKEY RRset must carry a valid
    // RRSIG by a DS-linked key, so we sign with keypairs we control.
    const parent = genKey(13);
    const child = genKey(13);
    const win = { inception: 1000, expiration: 2000 };
    const childDs = dsForKey('child.example', child.dnskey);
    const zones: RawZone[] = [
      {
        name: 'example',
        keys: [parent.dnskey],
        dsRecords: [dsForKey('example', parent.dnskey)],
        keyRrsigs: [signDnskeyRrset('example', [parent.dnskey], parent, win)],
      },
      {
        name: 'child.example',
        keys: [child.dnskey],
        dsRecords: [childDs],
        dsRrsigs: [
          signDsRrset('child.example', [childDs], 'example', parent, win),
        ],
        keyRrsigs: [
          signDnskeyRrset('child.example', [child.dnskey], child, win),
        ],
      },
    ];
    const chain = buildChain(zones, 1500);
    expect(chain.zones.map((z) => z.status)).toEqual(['secure', 'secure']);
    expect(chain.status).toBe('secure');
    expect(chain.zones[1].dsRecords[0].matchedKeyIndexes).toEqual([0]);
    // Every secure zone carries its DNSKEY RRSIG's expiry for expiry warnings.
    expect(chain.zones.map((z) => z.signatureExpiresAt)).toEqual([2000, 2000]);
  });

  it('enforces the real root trust anchor (fake root key -> broken)', () => {
    const chain = buildChain([{ name: '.', keys: [sep], dsRecords: [] }]);
    expect(chain.zones[0].status).toBe('broken');
    expect(chain.status).toBe('broken');
  });

  it('marks an unsigned zone insecure and propagates', () => {
    const zones: RawZone[] = [
      { name: 'example', keys: [], dsRecords: [] },
      { name: 'child.example', keys: [sep], dsRecords: [] },
    ];
    const chain = buildChain(zones);
    expect(chain.zones[0].status).toBe('insecure');
    expect(chain.status).toBe('insecure');
  });

  it('marks a DS-without-DNSKEY zone as broken (not insecure)', () => {
    const zones: RawZone[] = [
      { name: 'example', keys: [], dsRecords: [dsFor('example')] },
    ];
    const chain = buildChain(zones);
    expect(chain.zones[0].status).toBe('broken');
    expect(chain.status).toBe('broken');
  });

  it('marks a DS that matches no key as broken', () => {
    const wrongDs: DsData = { ...RFC_DS, digest: Buffer.alloc(20, 0xaa) };
    const zones: RawZone[] = [
      { name: 'example', keys: [sep], dsRecords: [wrongDs] },
    ];
    const chain = buildChain(zones);
    expect(chain.zones[0].status).toBe('broken');
    expect(chain.status).toBe('broken');
  });

  it('ignores a matching SHA-1 DS when a SHA-256 DS is present and mismatched', () => {
    // RFC 4509 §3: validators use only the strongest supported digest type in
    // the DS RRset. A matching SHA-1 DS must not link a key that the
    // co-published SHA-256 DS fails to authenticate -- compliant validators
    // ignore the SHA-1 record and report the delegation bogus.
    const k = genKey(13);
    const tag = computeKeyTag(dnskeyRdata(k.dnskey));
    const sha1Match: DsData = {
      keyTag: tag,
      algorithm: 13,
      digestType: 1,
      digest: dsDigest('example', k.dnskey, 1)!,
    };
    const sha256Mismatch: DsData = {
      keyTag: tag,
      algorithm: 13,
      digestType: 2,
      digest: Buffer.alloc(32, 0xaa),
    };
    const win = { inception: 1000, expiration: 2000 };
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: [k.dnskey],
          dsRecords: [sha256Mismatch, sha1Match],
          keyRrsigs: [signDnskeyRrset('example', [k.dnskey], k, win)],
        },
      ],
      1500,
    );

    expect(chain.zones[0]).toMatchObject({
      status: 'broken',
      breakReason: 'ds-mismatch',
    });
  });

  it('accepts a matching SHA-256 DS next to a mismatched SHA-384 sibling', () => {
    // RFC 4509 §3 only demotes SHA-1; SHA-256 and SHA-384 are both acceptable
    // paths, so a stale SHA-384 DS must not break a valid SHA-256 link.
    const k = genKey(13);
    const tag = computeKeyTag(dnskeyRdata(k.dnskey));
    const sha256Match: DsData = {
      keyTag: tag,
      algorithm: 13,
      digestType: 2,
      digest: dsDigest('example', k.dnskey, 2)!,
    };
    const sha384Mismatch: DsData = {
      keyTag: tag,
      algorithm: 13,
      digestType: 4,
      digest: Buffer.alloc(48, 0xaa),
    };
    const win = { inception: 1000, expiration: 2000 };
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: [k.dnskey],
          dsRecords: [sha384Mismatch, sha256Match],
          keyRrsigs: [signDnskeyRrset('example', [k.dnskey], k, win)],
        },
      ],
      1500,
    );

    expect(chain.zones[0].status).toBe('secure');
  });

  it('marks a zone broken when the DS key tag matches no served key', () => {
    // Correct digest + algorithm but a deliberately wrong key tag: a validator
    // would never select this key, so the DS authenticates nothing.
    const good = dsFor('example');
    const tagMismatch: DsData = { ...good, keyTag: good.keyTag + 1 };
    const chain = buildChain([
      { name: 'example', keys: [sep], dsRecords: [tagMismatch] },
    ]);
    expect(chain.zones[0].status).toBe('broken');
  });

  it('treats zones below an unsigned delegation as insecure, not broken', () => {
    // child.example would be `broken` in isolation (its DS matches no key), but
    // because its parent is an unsigned delegation the subtree is unauthenticated.
    const wrongDs: DsData = { ...RFC_DS, digest: Buffer.alloc(20, 0xbb) };
    const zones: RawZone[] = [
      { name: 'example', keys: [], dsRecords: [] },
      { name: 'child.example', keys: [sep], dsRecords: [wrongDs] },
    ];
    const chain = buildChain(zones);
    expect(chain.zones.map((z) => z.status)).toEqual(['insecure', 'insecure']);
    expect(chain.status).toBe('insecure');
  });

  it('flags the root anchor and KSK metadata', () => {
    const chain = buildChain([{ name: '.', keys: [sep], dsRecords: [] }]);
    expect(chain.zones[0].keys[0].isSep).toBe(true);
    expect(chain.zones[0].dsRecords).toHaveLength(ROOT_TRUST_ANCHORS.length);
  });
});

describe('buildChain signature enforcement', () => {
  const win = { inception: 1000, expiration: 2000 };
  const now = 1500;

  const signedZone = (name: string, algorithm: number): RawZone => {
    const k = genKey(algorithm);
    return {
      name,
      keys: [k.dnskey],
      dsRecords: [dsForKey(name, k.dnskey)],
      keyRrsigs: [signDnskeyRrset(name, [k.dnskey], k, win)],
    };
  };

  it('marks a DS-linked zone secure across RSA, ECDSA, and Ed25519', () => {
    for (const algorithm of [8, 13, 15]) {
      const chain = buildChain([signedZone('example', algorithm)], now);
      expect(chain.zones[0].status).toBe('secure');
    }
  });

  it('breaks a DS-linked zone with no DNSKEY RRSIG (bad-signature)', () => {
    const zone = signedZone('example', 13);
    delete zone.keyRrsigs;
    const chain = buildChain([zone], now);
    expect(chain.zones[0].status).toBe('broken');
    expect(chain.zones[0].breakReason).toBe('bad-signature');
  });

  it('breaks a DS-linked zone whose DNSKEY RRSIG is expired', () => {
    const chain = buildChain([signedZone('example', 13)], win.expiration + 1);
    expect(chain.zones[0].status).toBe('broken');
    expect(chain.zones[0].breakReason).toBe('bad-signature');
    expect(chain.zones[0].dnskeySignature).toEqual({
      status: 'expired',
      inceptionAt: win.inception,
      expiresAt: win.expiration,
    });
  });

  it('breaks (not insecure) when a linked key of a supported algorithm is malformed', () => {
    const k = genKey(13);
    // Same DS (computed over the served, corrupted key) but the key material
    // is unimportable: supported algorithm, broken configuration -> bogus,
    // not an unsupported algorithm.
    const malformed: DnskeyData = {
      ...k.dnskey,
      key: k.dnskey.key.subarray(0, 10),
    };
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: [malformed],
          dsRecords: [dsForKey('example', malformed)],
          keyRrsigs: [signDnskeyRrset('example', [malformed], k, win)],
        },
      ],
      now,
    );
    expect(chain.zones[0].status).toBe('broken');
    expect(chain.zones[0].breakReason).toBe('bad-signature');
  });

  it('treats a zone whose only authenticated DS is unsupported as insecure', () => {
    // RFC 4035 §5.2: with no supported authentication path from the parent,
    // the delegation is unvalidatable -- insecure, not bogus -- regardless of
    // the served key's flags.
    const generated = genKey(13);
    const ineligible: DnskeyData = {
      ...generated.dnskey,
      flags: 1,
      algorithm: 12,
    };
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: [ineligible],
          dsRecords: [dsForKey('example', ineligible)],
        },
      ],
      now,
    );

    expect(chain.zones[0]).toMatchObject({
      status: 'insecure',
      breakReason: 'unsupported-algorithm',
    });
  });

  it('breaks when the DNSKEY RRSIG signer is not DS-authenticated', () => {
    // Two keys in the RRset; a valid RRSIG by keyA, but the DS authenticates
    // only keyB. A zone must not vouch for its own key set with an un-anchored
    // key, so this is bogus even though the signature itself is valid.
    const a = genKey(13);
    const b = genKey(13);
    const rrset = [a.dnskey, b.dnskey];
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: rrset,
          dsRecords: [dsForKey('example', b.dnskey)], // links b, not a
          keyRrsigs: [signDnskeyRrset('example', rrset, a, win)], // signed by a
        },
      ],
      now,
    );
    expect(chain.zones[0].status).toBe('broken');
    expect(chain.zones[0].breakReason).toBe('bad-signature');
  });

  it('accepts a valid RRSIG by a DS-authenticated key in a multi-key RRset', () => {
    const a = genKey(13);
    const b = genKey(13);
    const rrset = [a.dnskey, b.dnskey];
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: rrset,
          dsRecords: [dsForKey('example', a.dnskey)], // links the signer
          keyRrsigs: [signDnskeyRrset('example', rrset, a, win)],
        },
      ],
      now,
    );
    expect(chain.zones[0].status).toBe('secure');
  });

  it('rejects a child DS RRset that is not signed by the authenticated parent', () => {
    const parent = genKey(13);
    const child = genKey(13);
    const childDs = dsForKey('child.example', child.dnskey);
    const zones: RawZone[] = [
      {
        name: 'example',
        keys: [parent.dnskey],
        dsRecords: [dsForKey('example', parent.dnskey)],
        keyRrsigs: [signDnskeyRrset('example', [parent.dnskey], parent, win)],
      },
      {
        name: 'child.example',
        keys: [child.dnskey],
        dsRecords: [childDs],
        keyRrsigs: [
          signDnskeyRrset('child.example', [child.dnskey], child, win),
        ],
      },
    ];

    const chain = buildChain(zones, now);
    expect(chain.zones[1]).toMatchObject({
      status: 'broken',
      breakReason: 'bad-ds-signature',
      dsSignature: { status: 'missing' },
    });
  });

  it('retains the expiry of an expired parent DS signature', () => {
    const parent = genKey(13);
    const child = genKey(13);
    const childDs = dsForKey('child.example', child.dnskey);
    const parentWin = { inception: 1000, expiration: 3000 };
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: [parent.dnskey],
          dsRecords: [dsForKey('example', parent.dnskey)],
          keyRrsigs: [
            signDnskeyRrset('example', [parent.dnskey], parent, parentWin),
          ],
        },
        {
          name: 'child.example',
          keys: [child.dnskey],
          dsRecords: [childDs],
          dsRrsigs: [
            signDsRrset('child.example', [childDs], 'example', parent, win),
          ],
          keyRrsigs: [
            signDnskeyRrset('child.example', [child.dnskey], child, parentWin),
          ],
        },
      ],
      win.expiration + 1,
    );

    expect(chain.zones[1]).toMatchObject({
      status: 'broken',
      breakReason: 'bad-ds-signature',
      dsSignature: {
        status: 'expired',
        inceptionAt: win.inception,
        expiresAt: win.expiration,
      },
    });
  });

  it('treats a DS RRset signed only with an unsupported algorithm as unvalidatable', () => {
    const parent = genKey(13);
    const unsupportedParentKey: DnskeyData = {
      flags: 256,
      algorithm: 12,
      key: Buffer.alloc(64, 7),
    };
    const child = genKey(13);
    const childDs = dsForKey('child.example', child.dnskey);
    const unsupportedRrsig = {
      ...signDsRrset('child.example', [childDs], 'example', parent, win),
      algorithm: 12,
      keyTag: computeKeyTag(dnskeyRdata(unsupportedParentKey)),
    };
    const parentRrset = [parent.dnskey, unsupportedParentKey];
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: parentRrset,
          dsRecords: [dsForKey('example', parent.dnskey)],
          keyRrsigs: [signDnskeyRrset('example', parentRrset, parent, win)],
        },
        {
          name: 'child.example',
          keys: [child.dnskey],
          dsRecords: [childDs],
          dsRrsigs: [unsupportedRrsig],
          keyRrsigs: [
            signDnskeyRrset('child.example', [child.dnskey], child, win),
          ],
        },
      ],
      now,
    );

    expect(chain.zones[1]).toMatchObject({
      status: 'insecure',
      breakReason: 'unsupported-algorithm',
    });
  });

  it('does not let an arbitrary unsupported RRSIG downgrade a bad DS signature', () => {
    const parent = genKey(13);
    const child = genKey(13);
    const childDs = dsForKey('child.example', child.dnskey);
    const forged = {
      ...signDsRrset('child.example', [childDs], 'example', parent, win),
      algorithm: 12,
      keyTag: 60000,
    };
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: [parent.dnskey],
          dsRecords: [dsForKey('example', parent.dnskey)],
          keyRrsigs: [signDnskeyRrset('example', [parent.dnskey], parent, win)],
        },
        {
          name: 'child.example',
          keys: [child.dnskey],
          dsRecords: [childDs],
          dsRrsigs: [forged],
          keyRrsigs: [
            signDnskeyRrset('child.example', [child.dnskey], child, win),
          ],
        },
      ],
      now,
    );

    expect(chain.zones[1]).toMatchObject({
      status: 'broken',
      breakReason: 'bad-ds-signature',
      dsSignature: { status: 'invalid' },
    });
  });

  it('does not let a matching unsupported DS rescue a mismatched supported DS', () => {
    const parent = genKey(13);
    const unsupportedChildKey: DnskeyData = {
      flags: 256,
      algorithm: 12,
      key: Buffer.alloc(64, 7),
    };
    const strayKey = genKey(13); // referenced by the supported DS, never served
    const dsSet = [
      dsForKey('child.example', strayKey.dnskey),
      dsForKey('child.example', unsupportedChildKey),
    ];
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: [parent.dnskey],
          dsRecords: [dsForKey('example', parent.dnskey)],
          keyRrsigs: [signDnskeyRrset('example', [parent.dnskey], parent, win)],
        },
        {
          name: 'child.example',
          keys: [unsupportedChildKey],
          dsRecords: dsSet,
          dsRrsigs: [
            signDsRrset('child.example', dsSet, 'example', parent, win),
          ],
        },
      ],
      now,
    );

    expect(chain.zones[1]).toMatchObject({
      status: 'broken',
      breakReason: 'ds-mismatch',
    });
  });

  it('keeps a failed supported DNSKEY path bogus despite an unsupported signer', () => {
    const parent = genKey(13);
    const child = genKey(13); // supported, DS-linked, but signs nothing
    const unsupportedKey: DnskeyData = {
      flags: 256,
      algorithm: 12,
      key: Buffer.alloc(64, 7),
    };
    const childKeys = [child.dnskey, unsupportedKey];
    const dsSet = [
      dsForKey('child.example', child.dnskey),
      dsForKey('child.example', unsupportedKey),
    ];
    const unsupportedSig = {
      ...signDnskeyRrset('child.example', childKeys, child, win),
      algorithm: 12,
      keyTag: computeKeyTag(dnskeyRdata(unsupportedKey)),
    };
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: [parent.dnskey],
          dsRecords: [dsForKey('example', parent.dnskey)],
          keyRrsigs: [signDnskeyRrset('example', [parent.dnskey], parent, win)],
        },
        {
          name: 'child.example',
          keys: childKeys,
          dsRecords: dsSet,
          dsRrsigs: [
            signDsRrset('child.example', dsSet, 'example', parent, win),
          ],
          keyRrsigs: [unsupportedSig],
        },
      ],
      now,
    );

    expect(chain.zones[1]).toMatchObject({
      status: 'broken',
      breakReason: 'bad-signature',
    });
  });

  it('does not let an in-window unsupported RRSIG mask an expired supported DS signature', () => {
    const parent = genKey(13);
    const unsupportedParentKey: DnskeyData = {
      flags: 256,
      algorithm: 12,
      key: Buffer.alloc(64, 7),
    };
    const child = genKey(13);
    const childDs = dsForKey('child.example', child.dnskey);
    const expiredSupported = signDsRrset(
      'child.example',
      [childDs],
      'example',
      parent,
      { inception: 100, expiration: 200 },
    );
    const inWindowUnsupported = {
      ...signDsRrset('child.example', [childDs], 'example', parent, win),
      algorithm: 12,
      keyTag: computeKeyTag(dnskeyRdata(unsupportedParentKey)),
    };
    const parentRrset = [parent.dnskey, unsupportedParentKey];
    const chain = buildChain(
      [
        {
          name: 'example',
          keys: parentRrset,
          dsRecords: [dsForKey('example', parent.dnskey)],
          keyRrsigs: [signDnskeyRrset('example', parentRrset, parent, win)],
        },
        {
          name: 'child.example',
          keys: [child.dnskey],
          dsRecords: [childDs],
          dsRrsigs: [expiredSupported, inWindowUnsupported],
          keyRrsigs: [
            signDnskeyRrset('child.example', [child.dnskey], child, win),
          ],
        },
      ],
      now,
    );

    expect(chain.zones[1]).toMatchObject({
      status: 'broken',
      breakReason: 'bad-ds-signature',
      dsSignature: { status: 'expired' },
    });
  });

  it('propagates a broken key signature down the chain', () => {
    const parent = signedZone('example', 13);
    delete parent.keyRrsigs; // parent key set unsigned -> broken
    const child = signedZone('child.example', 13);
    const chain = buildChain([parent, child], now);
    expect(chain.zones.map((z) => z.status)).toEqual(['broken', 'broken']);
    expect(chain.status).toBe('broken');
  });
});
