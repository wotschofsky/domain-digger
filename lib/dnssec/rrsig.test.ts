import type { DnskeyData, RrsigData } from 'dns-packet';
import { describe, expect, it, vi } from 'vitest';

import type * as Algorithms from './algorithms';
import { verifyWithDnskey } from './algorithms';
import { checkRrsetSignatures } from './rrsig';
import { genKey, signDnskeyRrset } from './test-helpers';
import {
  ROOT_DNSKEY_RRSIG,
  ROOT_DNSKEYS,
  ROOT_NOW,
  WSKY_DNSKEY_RRSIG,
  WSKY_DNSKEYS,
  WSKY_NOW,
} from './test-vectors';
import { dnskeyKeyTag, dnskeyRdata } from './wire';

// Count signature verifications while keeping the real crypto.
vi.mock('./algorithms', async (importOriginal) => {
  const actual = await importOriginal<typeof Algorithms>();
  return { ...actual, verifyWithDnskey: vi.fn(actual.verifyWithDnskey) };
});

// Different key material with the same RFC 4034 key tag: moving `n` between
// two odd-offset bytes leaves the checksum unchanged.
const sameTagKey = (key: Buffer, n: number): Buffer => {
  const odd = [...key.keys()].filter((i) => i % 2 === 1);
  const up = odd.find((i) => key[i] + n <= 255)!;
  const down = odd.find((i) => i !== up && key[i] - n >= 0)!;
  const variant = Buffer.from(key);
  variant[up] += n;
  variant[down] -= n;
  return variant;
};

// A zone's DNSKEY RRset vouched for by its own keys, the way resolveDsChain checks
// it (there, narrowed to the DS-linked keys).
const dnskeyOutcome = (params: {
  rrsig: RrsigData;
  keys: DnskeyData[];
  ownerName: string;
  now: number;
}) =>
  checkRrsetSignatures({
    type: 'DNSKEY',
    rdatas: params.keys.map((key) => dnskeyRdata(key)),
    rrsigs: [params.rrsig],
    ownerName: params.ownerName,
    signerName: params.ownerName,
    keys: params.keys,
    now: params.now,
  }).outcome;

describe('checkRrsetSignatures over DNSKEY RRsets (golden vectors)', () => {
  it('verifies the real root DNSKEY RRSIG (RSASHA256)', () => {
    expect(
      dnskeyOutcome({
        rrsig: ROOT_DNSKEY_RRSIG,
        keys: ROOT_DNSKEYS,
        ownerName: '.',
        now: ROOT_NOW,
      }),
    ).toBe('valid');
  });

  it('verifies the real wsky.dev DNSKEY RRSIG (ECDSAP256SHA256)', () => {
    expect(
      dnskeyOutcome({
        rrsig: WSKY_DNSKEY_RRSIG,
        keys: WSKY_DNSKEYS,
        ownerName: 'wsky.dev',
        now: WSKY_NOW,
      }),
    ).toBe('valid');
  });

  it('rejects an expired signature', () => {
    expect(
      dnskeyOutcome({
        rrsig: ROOT_DNSKEY_RRSIG,
        keys: ROOT_DNSKEYS,
        ownerName: '.',
        now: ROOT_DNSKEY_RRSIG.expiration + 1,
      }),
    ).toBe('expired');
  });

  it('rejects a not-yet-valid signature', () => {
    expect(
      dnskeyOutcome({
        rrsig: ROOT_DNSKEY_RRSIG,
        keys: ROOT_DNSKEYS,
        ownerName: '.',
        now: ROOT_DNSKEY_RRSIG.inception - 1,
      }),
    ).toBe('not-yet-valid');
  });

  it('rejects a tampered signature', () => {
    const signature = Buffer.from(ROOT_DNSKEY_RRSIG.signature);
    signature[0] ^= 0xff;
    expect(
      dnskeyOutcome({
        rrsig: { ...ROOT_DNSKEY_RRSIG, signature },
        keys: ROOT_DNSKEYS,
        ownerName: '.',
        now: ROOT_NOW,
      }),
    ).toBe('invalid');
  });

  it('rejects when the RRset is altered (a DNSKEY dropped)', () => {
    // The RRSIG covers the whole DNSKEY RRset; removing any key changes the
    // canonical bytes and the signature no longer matches.
    expect(
      dnskeyOutcome({
        rrsig: ROOT_DNSKEY_RRSIG,
        keys: ROOT_DNSKEYS.slice(1),
        ownerName: '.',
        now: ROOT_NOW,
      }),
    ).toBe('invalid');
  });

  it('rejects the wrong owner name', () => {
    expect(
      dnskeyOutcome({
        rrsig: WSKY_DNSKEY_RRSIG,
        keys: WSKY_DNSKEYS,
        ownerName: 'other.dev',
        now: WSKY_NOW,
      }),
    ).toBe('invalid');
  });

  it('rejects when no served key has the signing tag', () => {
    expect(
      dnskeyOutcome({
        rrsig: { ...ROOT_DNSKEY_RRSIG, keyTag: 11111 },
        keys: ROOT_DNSKEYS,
        ownerName: '.',
        now: ROOT_NOW,
      }),
    ).toBe('unauthenticated-signer');
  });

  it('rejects a DNSKEY RRSIG whose signer name is not the zone apex', () => {
    const k = genKey(13);
    const rrsig = signDnskeyRrset('example', [k.dnskey], k, {
      inception: 1000,
      expiration: 2000,
    });
    // Crypto-valid signature, but the declared signer is a different zone --
    // validating resolvers reject this (RFC 4035 §5.3.1).
    const wrongSigner = { ...rrsig, signersName: 'other' };
    expect(
      dnskeyOutcome({
        rrsig: wrongSigner,
        keys: [k.dnskey],
        ownerName: 'example',
        now: 1500,
      }),
    ).toBe('invalid');
  });

  it('rejects a DNSKEY RRSIG made by a revoked key (RFC 5011)', () => {
    const k = genKey(13);
    const revoked: DnskeyData = { ...k.dnskey, flags: k.dnskey.flags | 0x0080 };
    const rrsig = signDnskeyRrset(
      'example',
      [revoked],
      { ...k, dnskey: revoked },
      { inception: 1000, expiration: 2000 },
    );
    expect(
      dnskeyOutcome({
        rrsig,
        keys: [revoked],
        ownerName: 'example',
        now: 1500,
      }),
    ).toBe('unauthenticated-signer');
  });

  it('rejects a DNSKEY RRSIG made by a key without the ZONE flag', () => {
    const k = genKey(13);
    const nonZone: DnskeyData = { ...k.dnskey, flags: 1 };
    const rrsig = signDnskeyRrset(
      'example',
      [nonZone],
      { ...k, dnskey: nonZone },
      { inception: 1000, expiration: 2000 },
    );
    expect(
      dnskeyOutcome({
        rrsig,
        keys: [nonZone],
        ownerName: 'example',
        now: 1500,
      }),
    ).toBe('unauthenticated-signer');
  });

  it('rejects a crypto-valid DNSKEY RRSIG with an invalid Labels count', () => {
    const signer = genKey(13);
    const rrsig = signDnskeyRrset('example', [signer.dnskey], signer, {
      inception: 1000,
      expiration: 2000,
      labels: 2,
    });

    expect(
      dnskeyOutcome({
        rrsig,
        keys: [signer.dnskey],
        ownerName: 'example',
        now: 1500,
      }),
    ).toBe('invalid');
  });
  it('tries every key sharing the signer tag, so a legitimate collision verifies', () => {
    const signer = genKey(13);
    const decoy = { ...signer.dnskey, key: sameTagKey(signer.dnskey.key, 1) };
    expect(dnskeyKeyTag(decoy)).toBe(dnskeyKeyTag(signer.dnskey));
    const keys = [decoy, signer.dnskey];
    const rrsig = signDnskeyRrset('example', keys, signer, {
      inception: 1000,
      expiration: 2000,
    });

    expect(
      dnskeyOutcome({ rrsig, keys, ownerName: 'example', now: 1500 }),
    ).toBe('valid');
  });

  it('bounds signature checks when many linked keys share a key tag (KeyTrap)', () => {
    const base = { flags: 257, algorithm: 13, key: Buffer.alloc(64, 0x40) };
    const keys = Array.from({ length: 16 }, (_, n) => ({
      ...base,
      key: sameTagKey(base.key, n),
    }));
    expect(new Set(keys.map((key) => dnskeyKeyTag(key))).size).toBe(1);
    const rrsigs = keys.map(
      (_, n): RrsigData => ({
        typeCovered: 'DNSKEY',
        algorithm: 13,
        labels: 1,
        originalTTL: 3600,
        expiration: 2000,
        inception: 1000,
        keyTag: dnskeyKeyTag(base),
        signersName: 'example',
        signature: Buffer.alloc(64, n),
      }),
    );
    vi.mocked(verifyWithDnskey).mockClear();

    const { outcome } = checkRrsetSignatures({
      type: 'DNSKEY',
      rdatas: keys.map((key) => dnskeyRdata(key)),
      rrsigs,
      ownerName: 'example',
      signerName: 'example',
      keys,
      now: 1500,
    });

    expect(outcome).toBe('invalid');
    expect(vi.mocked(verifyWithDnskey).mock.calls.length).toBeLessThanOrEqual(
      8,
    );
  });

  it('verifies a DNSKEY RRSIG despite a duplicated DNSKEY record', () => {
    const key = genKey(13);
    const rrsig = signDnskeyRrset('example', [key.dnskey], key, {
      inception: 1000,
      expiration: 2000,
    });

    expect(
      dnskeyOutcome({
        rrsig,
        keys: [key.dnskey, key.dnskey],
        ownerName: 'example',
        now: 1500,
      }),
    ).toBe('valid');
  });
});
