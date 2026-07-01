import {
  sign as cryptoSign,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';

import type { DnskeyData, DsData, RrsigData } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import {
  buildChain,
  canonicalRdata,
  computeKeyTag,
  dnskeyRdata,
  dnskeyToPublicKey,
  dsDigest,
  dsMatchesKey,
  isDeprecatedAlgorithm,
  isWeakDigest,
  keyBits,
  type RawZone,
  ROOT_TRUST_ANCHORS,
  validatePositiveRrset,
  verifyDnskeyRrsig,
  verifyRrsetRrsig,
  wireName,
} from './dnssec';

const u16 = (n: number): Buffer => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
};
const u32 = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};

const dnskey = (
  flags: number,
  algorithm: number,
  keyB64: string,
): DnskeyData => ({
  flags,
  algorithm,
  key: Buffer.from(keyB64, 'base64'),
});

const dsForKey = (name: string, key: DnskeyData): DsData => ({
  keyTag: computeKeyTag(dnskeyRdata(key)),
  algorithm: key.algorithm,
  digestType: 2,
  digest: dsDigest(name, key, 2)!,
});

// A live keypair whose DNSKEY we can sign with -- lets tests exercise the real
// verify path (buildChain propagation, expiry, forgery) for keys we hold the
// private half of. The golden vectors below independently prove the canonical
// encoding against real-world signers (BIND root, Cloudflare), so a shared bug
// between this signer and the verifier could not pass both.
const genKey = (algorithm: number): { priv: KeyObject; dnskey: DnskeyData } => {
  if (algorithm === 8) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const jwk = publicKey.export({ format: 'jwk' }) as { n: string; e: string };
    const n = Buffer.from(jwk.n, 'base64url');
    const e = Buffer.from(jwk.e, 'base64url');
    return {
      priv: privateKey,
      dnskey: {
        flags: 257,
        algorithm,
        key: Buffer.concat([Buffer.from([e.length]), e, n]),
      },
    };
  }
  if (algorithm === 13) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    return {
      priv: privateKey,
      dnskey: {
        flags: 257,
        algorithm,
        key: Buffer.concat([
          Buffer.from(jwk.x, 'base64url'),
          Buffer.from(jwk.y, 'base64url'),
        ]),
      },
    };
  }
  // 15 Ed25519
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
  return {
    priv: privateKey,
    dnskey: { flags: 257, algorithm, key: Buffer.from(jwk.x, 'base64url') },
  };
};

// Sign a zone's DNSKEY RRset with `signer`, mirroring the canonical encoding in
// dnssec.ts (RFC 4034 §3.1.8.1 / §6). `rrset` is every DNSKEY at the apex.
const signDnskeyRrset = (
  name: string,
  rrset: DnskeyData[],
  signer: { priv: KeyObject; dnskey: DnskeyData },
  opts: { inception: number; expiration: number },
): RrsigData => {
  const { priv, dnskey: sk } = signer;
  const { algorithm } = sk;
  const keyTag = computeKeyTag(dnskeyRdata(sk));
  const labels = name.split('.').filter(Boolean).length;
  const prefix = Buffer.concat([
    u16(48),
    Buffer.from([algorithm, labels]),
    u32(3600),
    u32(opts.expiration),
    u32(opts.inception),
    u16(keyTag),
    wireName(name),
  ]);
  const rrs = rrset
    .map((k) => dnskeyRdata(k))
    .sort(Buffer.compare)
    .map((r) =>
      Buffer.concat([
        wireName(name),
        u16(48),
        u16(1),
        u32(3600),
        u16(r.length),
        r,
      ]),
    );
  const data = Buffer.concat([prefix, ...rrs]);
  const signature =
    algorithm === 15
      ? cryptoSign(null, data, priv)
      : algorithm === 13
        ? cryptoSign('sha256', data, { key: priv, dsaEncoding: 'ieee-p1363' })
        : cryptoSign('sha256', data, priv);
  return {
    typeCovered: 'DNSKEY',
    algorithm,
    labels,
    originalTTL: 3600,
    expiration: opts.expiration,
    inception: opts.inception,
    keyTag,
    signersName: name,
    signature,
  };
};

const rrTypeCode = (type: string): number => {
  switch (type) {
    case 'A':
      return 1;
    case 'DNSKEY':
      return 48;
    default:
      throw new Error(`unsupported test type ${type}`);
  }
};

const aRdata = (ip: string): Buffer => Buffer.from(ip.split('.').map(Number));

const canonicalRrForTest = (
  owner: string,
  type: string,
  ttl: number,
  rdata: Buffer,
): Buffer =>
  Buffer.concat([
    wireName(owner),
    u16(rrTypeCode(type)),
    u16(1),
    u32(ttl),
    u16(rdata.length),
    rdata,
  ]);

const signARecordRrset = (
  ownerName: string,
  records: Array<{ name: string; type: 'A'; data: string }>,
  signerName: string,
  signer: { priv: KeyObject; dnskey: DnskeyData },
  opts: { inception: number; expiration: number },
): RrsigData => {
  const { priv, dnskey: sk } = signer;
  const keyTag = computeKeyTag(dnskeyRdata(sk));
  const labels = ownerName.split('.').filter(Boolean).length;
  const prefix = Buffer.concat([
    u16(1),
    Buffer.from([sk.algorithm, labels]),
    u32(300),
    u32(opts.expiration),
    u32(opts.inception),
    u16(keyTag),
    wireName(signerName),
  ]);
  const rrset = records
    .map((record) => aRdata(record.data))
    .sort(Buffer.compare)
    .map((rdata) => canonicalRrForTest(ownerName, 'A', 300, rdata));
  const data = Buffer.concat([prefix, ...rrset]);
  const signature =
    sk.algorithm === 15
      ? cryptoSign(null, data, priv)
      : sk.algorithm === 13
        ? cryptoSign('sha256', data, { key: priv, dsaEncoding: 'ieee-p1363' })
        : cryptoSign('sha256', data, priv);
  return {
    typeCovered: 'A',
    algorithm: sk.algorithm,
    labels,
    originalTTL: 300,
    expiration: opts.expiration,
    inception: opts.inception,
    keyTag,
    signersName: signerName,
    signature,
  };
};

// --- Golden vectors: real DNSKEY RRsets + their DNSKEY RRSIGs, captured with
// `dig +dnssec DNSKEY`. `now` is pinned inside each signature's validity window
// so these never flake. They verify the canonical encoding against independent,
// real-world signers for the two dominant algorithms (RSASHA256, ECDSAP256).

// Root zone (RSASHA256), signed by the IANA KSK, key tag 20326.
const ROOT_DNSKEYS: DnskeyData[] = [
  dnskey(
    256,
    8,
    'AwEAAeCYD6Z7WWKVLeuWgowKP+3g+Gs1cnLKq7a3CaQxQpv8bfuFVI0WnG33qaSH/Mw9IBgifrdzf4XY/DQLnyBJ9MfaOyAWuEaEmYJ+GQPiwVVfstGwSA1McfFJUttTgq2Huu74KARhtA8wPo/N3XcyYQtNhz+qCM5NBb3ecx/naw6sYab9LxS6f2cU0q03++BP5Ks0Uef8WJCa/1izCYE+vMkwoltV+tENa3hpXiZ7jle/xdgaZrPi5ZGmyLVI34g1XVYrNlsCCTmNvFQIfzW5STFQFsQpizczyFn9r3LzSxxPCNwdlCG84bER0BmdwqbF6Tanv+FxMOavrahkj4wIy5k=',
  ),
  dnskey(
    257,
    8,
    'AwEAAaz/tAm8yTn4Mfeh5eyI96WSVexTBAvkMgJzkKTOiW1vkIbzxeF3+/4RgWOq7HrxRixHlFlExOLAJr5emLvN7SWXgnLh4+B5xQlNVz8Og8kvArMtNROxVQuCaSnIDdD5LKyWbRd2n9WGe2R8PzgCmr3EgVLrjyBxWezF0jLHwVN8efS3rCj/EWgvIWgb9tarpVUDK/b58Da+sqqls3eNbuv7pr+eoZG+SrDK6nWeL3c6H5Apxz7LjVc1uTIdsIXxuOLYA4/ilBmSVIzuDWfdRUfhHdY6+cn8HFRm+2hM8AnXGXws9555KrUB5qihylGa8subX2Nn6UwNR1AkUTV74bU=',
  ),
  dnskey(
    256,
    8,
    'AwEAAb5dDYffpgAJ8VUGLwQtWXPlQWsjIFJtCM00/XaKU+8ln+ofah3q2KxEIjvzQg+nqdxRj+8emtPne1mtYcbFWP4Q9E+DniOJLK09R05FuzvGbrG7DDdRDUX/cedFdV7O8pFEAYpJqYNR9BCTIAV973DO2biauKSA31b7I2lK/woxoR1tf5cqJ4SMbJUviuHicAEoUi2ATswloZNWd5T5thmEFZnxFx7D5UgKCY7oflS7+GU7dNJwEtmFnWYVETHN0kHXVz6aguouaAZp706YXNIoR/iTgQhmsR7XX+wL0Z8QM2LxQIyU6vRZ06IyuJMGRMiwkSuGElbumyBt12JZbrU=',
  ),
  dnskey(
    257,
    8,
    'AwEAAa96jeuknZlaeSrvyAJj6ZHv28hhOKkx3rLGXVaC6rXTsDc449/cidltpkyGwCJNnOAlFNKF2jBosZBU5eeHspaQWOmOElZsjICMQMC3aeHbGiShvZsx4wMYSjH8e7Vrhbu6irwCzVBApESjbUdpWWmEnhathWu1jo+siFUiRAAxm9qyJNg/wOZqqzL/dL/q8PkcRU5oUKEpUge71M3ej2/7CPqpdVwuMoTvoB+ZOT4YeGyxMvHmbrxlFzGOHOijtzN+u1TQNatX2XBuzZNQ1K+s2CXkPIZo7s6JgZyvaBevYtxPvYLw4z9mR7K2vaF18UYH9Z9GNUUeayffKC73PYc=',
  ),
];
const ROOT_DNSKEY_RRSIG: RrsigData = {
  typeCovered: 'DNSKEY',
  algorithm: 8,
  labels: 0,
  originalTTL: 172800,
  expiration: 1784678400, // 2026-07-22 00:00:00 UTC
  inception: 1782864000, // 2026-07-01 00:00:00 UTC
  keyTag: 20326,
  signersName: '.',
  signature: Buffer.from(
    'PIWRr97cYGmtOj+ITFeA8BqCHizd3FW/RykfcnMqVXQ7OqcE3lACjOoYfj+aj1iZfAP59iNsOWJz/J7AUAqxb7CpPIO9bJxllbhHyRkKEJhCO4M/MvlYAMmc6G8gnI4yBZEIiRPaFOP0Ux04kX/CMk4KoM89Rv4sQy02hsF7HeQb7GAowyKSW3hy0TazdwGeRyC00SjDCVZMVNCc8gPF4ZZsWgSmkpDDj3H1V5JSzLiu/mtf0k/6oHTi0IrsaBKywdQO9JgAOvayfW0hhySQ2FoQSrZC5Hb1btjvkzj49LxGTy0qvoRdHLjmnrsk8BqNlekAhJoLtIB+HEla/s1/DQ==',
    'base64',
  ),
};
const ROOT_NOW = 1782950400; // within the window

// wsky.dev (ECDSAP256SHA256), signed by its KSK, key tag 2371.
const WSKY_DNSKEYS: DnskeyData[] = [
  dnskey(
    257,
    13,
    'mdsswUyr3DPW132mOi8V9xESWE8jTo0dxCjjnopKl+GqJxpVXckHAeF+KkxLbxILfDLUT0rAK9iUzy1L53eKGQ==',
  ),
  dnskey(
    256,
    13,
    'oJMRESz5E4gYzS/q6XDrvU1qMPYIjCWzJaOau8XNEZeqCYKD5ar0IRd8KqXXFJkqmVfRvMGPmM1x8fGAa2XhSA==',
  ),
];
const WSKY_DNSKEY_RRSIG: RrsigData = {
  typeCovered: 'DNSKEY',
  algorithm: 13,
  labels: 2,
  originalTTL: 3600,
  expiration: 1787564388,
  inception: 1782293988,
  keyTag: 2371,
  signersName: 'wsky.dev',
  signature: Buffer.from(
    'bWnpt80RbJPgeMeaIM+Q+XMuXAgewTsW04P9ltGSdyZEtexlICuObJiACCFjcH4lhVZjza37kRluO+CvtZtruw==',
    'base64',
  ),
};
const WSKY_NOW = 1782380388; // within the window

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

  it('parses the RSA modulus length in bits', () => {
    // The RFC 4034 dskey.example.com key is a 1024-bit RSA key.
    expect(keyBits(RFC_KEY)).toBe(1024);
  });

  it('reports curve size for ECDSA/EdDSA keys', () => {
    expect(keyBits({ algorithm: 13, key: Buffer.alloc(64) })).toBe(256);
    expect(keyBits({ algorithm: 15, key: Buffer.alloc(32) })).toBe(256);
    expect(keyBits({ algorithm: 99, key: Buffer.alloc(10) })).toBeNull();
  });

  it('flags deprecated algorithms and weak digests', () => {
    expect(isDeprecatedAlgorithm(5)).toBe(true); // RSASHA1
    expect(isDeprecatedAlgorithm(13)).toBe(false); // ECDSAP256SHA256
    expect(isWeakDigest(1)).toBe(true); // SHA-1
    expect(isWeakDigest(2)).toBe(false); // SHA-256
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

  it('marks a fully linked, validly-signed chain secure', () => {
    // Real signatures required now: each zone's DNSKEY RRset must carry a valid
    // RRSIG by a DS-linked key, so we sign with keypairs we control.
    const parent = genKey(13);
    const child = genKey(13);
    const win = { inception: 1000, expiration: 2000 };
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
        dsRecords: [dsForKey('child.example', child.dnskey)],
        keyRrsigs: [
          signDnskeyRrset('child.example', [child.dnskey], child, win),
        ],
      },
    ];
    const chain = buildChain(zones, 1500);
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

  it('rejects a DS whose key tag does not match the DNSKEY', () => {
    // Correct digest + algorithm but a deliberately wrong key tag: a validator
    // would never select this key, so it must not count as a match.
    const good = dsFor('example');
    const tagMismatch: DsData = { ...good, keyTag: good.keyTag + 1 };
    expect(dsMatchesKey(tagMismatch, sep, 'example')).toBe(false);
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
    expect(chain.overall).toBe('insecure');
  });

  it('flags the root anchor and KSK metadata', () => {
    const chain = buildChain([{ name: '.', keys: [sep], dsRecords: [] }]);
    expect(chain.zones[0].displayName).toBe('root');
    expect(chain.zones[0].keys[0].isSep).toBe(true);
    expect(chain.zones[0].dsRecords).toHaveLength(ROOT_TRUST_ANCHORS.length);
  });
});

describe('dnskeyToPublicKey', () => {
  it('reconstructs RSA, ECDSA, and Ed25519 keys', () => {
    expect(dnskeyToPublicKey(8, ROOT_DNSKEYS[1].key)).not.toBeNull(); // RSA
    expect(dnskeyToPublicKey(13, WSKY_DNSKEYS[0].key)).not.toBeNull(); // ECDSA
    expect(dnskeyToPublicKey(15, genKey(15).dnskey.key)).not.toBeNull(); // Ed25519
  });

  it('returns null for unknown or malformed keys', () => {
    expect(dnskeyToPublicKey(99, Buffer.alloc(10))).toBeNull(); // unknown alg
    expect(dnskeyToPublicKey(13, Buffer.alloc(10))).toBeNull(); // wrong EC size
    expect(dnskeyToPublicKey(8, Buffer.alloc(0))).toBeNull(); // empty RSA
  });
});

describe('verifyDnskeyRrsig (golden vectors)', () => {
  it('verifies the real root DNSKEY RRSIG (RSASHA256)', () => {
    expect(
      verifyDnskeyRrsig({
        rrsig: ROOT_DNSKEY_RRSIG,
        keys: ROOT_DNSKEYS,
        ownerName: '.',
        now: ROOT_NOW,
      }),
    ).toBe(true);
  });

  it('verifies the real wsky.dev DNSKEY RRSIG (ECDSAP256SHA256)', () => {
    expect(
      verifyDnskeyRrsig({
        rrsig: WSKY_DNSKEY_RRSIG,
        keys: WSKY_DNSKEYS,
        ownerName: 'wsky.dev',
        now: WSKY_NOW,
      }),
    ).toBe(true);
  });

  it('rejects an expired signature', () => {
    expect(
      verifyDnskeyRrsig({
        rrsig: ROOT_DNSKEY_RRSIG,
        keys: ROOT_DNSKEYS,
        ownerName: '.',
        now: ROOT_DNSKEY_RRSIG.expiration + 1,
      }),
    ).toBe(false);
  });

  it('rejects a not-yet-valid signature', () => {
    expect(
      verifyDnskeyRrsig({
        rrsig: ROOT_DNSKEY_RRSIG,
        keys: ROOT_DNSKEYS,
        ownerName: '.',
        now: ROOT_DNSKEY_RRSIG.inception - 1,
      }),
    ).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const signature = Buffer.from(ROOT_DNSKEY_RRSIG.signature);
    signature[0] ^= 0xff;
    expect(
      verifyDnskeyRrsig({
        rrsig: { ...ROOT_DNSKEY_RRSIG, signature },
        keys: ROOT_DNSKEYS,
        ownerName: '.',
        now: ROOT_NOW,
      }),
    ).toBe(false);
  });

  it('rejects when the RRset is altered (a DNSKEY dropped)', () => {
    // The RRSIG covers the whole DNSKEY RRset; removing any key changes the
    // canonical bytes and the signature no longer matches.
    expect(
      verifyDnskeyRrsig({
        rrsig: ROOT_DNSKEY_RRSIG,
        keys: ROOT_DNSKEYS.slice(1),
        ownerName: '.',
        now: ROOT_NOW,
      }),
    ).toBe(false);
  });

  it('rejects the wrong owner name', () => {
    expect(
      verifyDnskeyRrsig({
        rrsig: WSKY_DNSKEY_RRSIG,
        keys: WSKY_DNSKEYS,
        ownerName: 'other.dev',
        now: WSKY_NOW,
      }),
    ).toBe(false);
  });

  it('rejects when no served key has the signing tag', () => {
    expect(
      verifyDnskeyRrsig({
        rrsig: { ...ROOT_DNSKEY_RRSIG, keyTag: 11111 },
        keys: ROOT_DNSKEYS,
        ownerName: '.',
        now: ROOT_NOW,
      }),
    ).toBe(false);
  });
});

describe('positive RRset validation', () => {
  const win = { inception: 1000, expiration: 2000 };
  const now = 1500;
  const ownerName = 'www.example';
  const signerName = 'example';
  const records = [
    { name: ownerName, type: 'A' as const, data: '192.0.2.2' },
    { name: ownerName, type: 'A' as const, data: '192.0.2.1' },
  ];

  it('canonicalizes supported RDATA without the DNS packet length prefix', () => {
    expect(canonicalRdata('A', '192.0.2.1')?.toString('hex')).toBe('c0000201');
  });

  it('verifies a positive A RRset RRSIG', () => {
    const signer = genKey(13);
    const rrsig = signARecordRrset(ownerName, records, signerName, signer, win);

    expect(
      verifyRrsetRrsig({
        rrsig,
        type: 'A',
        records,
        ownerName,
        signerName,
        keys: [signer.dnskey],
        now,
      }),
    ).toBe(true);
  });

  it('reports a signed positive RRset as secure', () => {
    const signer = genKey(13);
    const rrsig = signARecordRrset(ownerName, records, signerName, signer, win);
    const keyTag = computeKeyTag(dnskeyRdata(signer.dnskey));

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [rrsig],
        keys: [signer.dnskey],
        authenticatedKeyTags: new Set([keyTag]),
        signerName,
        now,
      }),
    ).toMatchObject({
      type: 'A',
      status: 'secure',
      reason: 'validated',
      recordCount: 2,
      signerKeyTag: keyTag,
      signatureExpiresAt: win.expiration,
    });
  });

  it('accepts positive RRsets signed by any key in the authenticated DNSKEY set', () => {
    const ksk = genKey(13);
    const zsk = genKey(13);
    const zskRecord: DnskeyData = { ...zsk.dnskey, flags: 256 };
    const rrsig = signARecordRrset(
      ownerName,
      records,
      signerName,
      {
        ...zsk,
        dnskey: zskRecord,
      },
      win,
    );
    const zskTag = computeKeyTag(dnskeyRdata(zskRecord));

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [rrsig],
        keys: [ksk.dnskey, zskRecord],
        authenticatedKeyTags: new Set([
          computeKeyTag(dnskeyRdata(ksk.dnskey)),
          zskTag,
        ]),
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'secure',
      signerKeyTag: zskTag,
    });
  });

  it('reports existing records without a covering RRSIG as unsigned', () => {
    const signer = genKey(13);
    const keyTag = computeKeyTag(dnskeyRdata(signer.dnskey));

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [],
        keys: [signer.dnskey],
        authenticatedKeyTags: new Set([keyTag]),
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'unsigned',
      reason: 'missing-rrsig',
      recordCount: 2,
    });
  });

  it('reports tampered positive RRset signatures as bogus', () => {
    const signer = genKey(13);
    const rrsig = signARecordRrset(ownerName, records, signerName, signer, win);
    rrsig.signature = Buffer.from(rrsig.signature);
    rrsig.signature[0] ^= 0xff;
    const keyTag = computeKeyTag(dnskeyRdata(signer.dnskey));

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [rrsig],
        keys: [signer.dnskey],
        authenticatedKeyTags: new Set([keyTag]),
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'bogus',
      reason: 'invalid-signature',
    });
  });

  it('rejects a positive RRset signed by an unauthenticated key', () => {
    const signer = genKey(13);
    const rrsig = signARecordRrset(ownerName, records, signerName, signer, win);

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [rrsig],
        keys: [signer.dnskey],
        authenticatedKeyTags: new Set(),
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'bogus',
      reason: 'unauthenticated-signer',
    });
  });

  it('reports absent positive RRsets without pretending to prove denial', () => {
    const signer = genKey(13);
    const keyTag = computeKeyTag(dnskeyRdata(signer.dnskey));

    expect(
      validatePositiveRrset({
        type: 'MX',
        ownerName,
        records: [],
        rrsigs: [],
        keys: [signer.dnskey],
        authenticatedKeyTags: new Set([keyTag]),
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'absent',
      reason: 'no-records',
      recordCount: 0,
    });
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

  it('propagates a broken key signature down the chain', () => {
    const parent = signedZone('example', 13);
    delete parent.keyRrsigs; // parent key set unsigned -> broken
    const child = signedZone('child.example', 13);
    const chain = buildChain([parent, child], now);
    expect(chain.zones.map((z) => z.status)).toEqual(['broken', 'broken']);
    expect(chain.overall).toBe('broken');
  });
});
