import type { DnskeyData } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import { verifyDnskeyRrsig, verifyRrsetRrsig } from './rrsig';
import { genKey, signARecordRrset, signDnskeyRrset } from './test-helpers';
import {
  ROOT_DNSKEY_RRSIG,
  ROOT_DNSKEYS,
  ROOT_NOW,
  WSKY_DNSKEY_RRSIG,
  WSKY_DNSKEYS,
  WSKY_NOW,
} from './test-vectors';

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
      verifyDnskeyRrsig({
        rrsig: wrongSigner,
        keys: [k.dnskey],
        ownerName: 'example',
        now: 1500,
      }),
    ).toBe(false);
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
      verifyDnskeyRrsig({
        rrsig,
        keys: [revoked],
        ownerName: 'example',
        now: 1500,
      }),
    ).toBe(false);
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
      verifyDnskeyRrsig({
        rrsig,
        keys: [nonZone],
        ownerName: 'example',
        now: 1500,
      }),
    ).toBe(false);
  });

  it('rejects a crypto-valid DNSKEY RRSIG with an invalid Labels count', () => {
    const signer = genKey(13);
    const rrsig = signDnskeyRrset('example', [signer.dnskey], signer, {
      inception: 1000,
      expiration: 2000,
      labels: 2,
    });

    expect(
      verifyDnskeyRrsig({
        rrsig,
        keys: [signer.dnskey],
        ownerName: 'example',
        now: 1500,
      }),
    ).toBe(false);
  });
});

describe('verifyRrsetRrsig', () => {
  it('verifies a positive A RRset RRSIG', () => {
    const ownerName = 'www.example';
    const signerName = 'example';
    const records = [
      { name: ownerName, type: 'A' as const, data: '192.0.2.2' },
      { name: ownerName, type: 'A' as const, data: '192.0.2.1' },
    ];
    const signer = genKey(13);
    const rrsig = signARecordRrset(ownerName, records, signerName, signer, {
      inception: 1000,
      expiration: 2000,
    });

    expect(
      verifyRrsetRrsig({
        rrsig,
        type: 'A',
        records,
        ownerName,
        signerName,
        keys: [signer.dnskey],
        now: 1500,
      }),
    ).toBe(true);
  });

  it('verifies a wildcard-expanded positive RRset', () => {
    const ownerName = 'www.example';
    const signerName = 'example';
    const records = [
      { name: ownerName, type: 'A' as const, data: '192.0.2.1' },
    ];
    const signer = genKey(13);
    const rrsig = signARecordRrset(ownerName, records, signerName, signer, {
      inception: 1000,
      expiration: 2000,
      labels: 1,
      signedOwnerName: '*.example',
    });

    expect(
      verifyRrsetRrsig({
        rrsig,
        type: 'A',
        records,
        ownerName,
        signerName,
        keys: [signer.dnskey],
        now: 1500,
      }),
    ).toBe(true);
  });

  it('rejects a crypto-valid RRSIG whose Labels count exceeds the owner', () => {
    const ownerName = 'www.example';
    const signerName = 'example';
    const records = [
      { name: ownerName, type: 'A' as const, data: '192.0.2.1' },
    ];
    const signer = genKey(13);
    const rrsig = signARecordRrset(ownerName, records, signerName, signer, {
      inception: 1000,
      expiration: 2000,
      labels: 3,
    });

    expect(
      verifyRrsetRrsig({
        rrsig,
        type: 'A',
        records,
        ownerName,
        signerName,
        keys: [signer.dnskey],
        now: 1500,
      }),
    ).toBe(false);
  });
});
