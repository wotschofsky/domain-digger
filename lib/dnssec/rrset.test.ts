import type { DnskeyData } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import { signerId, validatePositiveRrset } from './rrset';
import { genKey, signARecordRrset } from './test-helpers';
import { computeKeyTag, dnskeyRdata } from './wire';

describe('positive RRset validation', () => {
  const win = { inception: 1000, expiration: 2000 };
  const now = 1500;
  const ownerName = 'www.example';
  const signerName = 'example';
  const records = [
    { name: ownerName, type: 'A' as const, data: '192.0.2.2' },
    { name: ownerName, type: 'A' as const, data: '192.0.2.1' },
  ];

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
        authenticatedKeyIds: new Set([signerId(13, keyTag)]),
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
        authenticatedKeyIds: new Set([
          signerId(13, computeKeyTag(dnskeyRdata(ksk.dnskey))),
          signerId(13, zskTag),
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
        authenticatedKeyIds: new Set([signerId(13, keyTag)]),
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
        authenticatedKeyIds: new Set([signerId(13, keyTag)]),
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'bogus',
      reason: 'invalid-signature',
    });
  });

  it('reports an authenticated but unsupported signing algorithm as unsupported', () => {
    const signer = genKey(13);
    const unsupportedKey: DnskeyData = {
      ...signer.dnskey,
      algorithm: 12,
    };
    const keyTag = computeKeyTag(dnskeyRdata(unsupportedKey));
    const rrsig = {
      ...signARecordRrset(ownerName, records, signerName, signer, win),
      algorithm: 12,
      keyTag,
    };

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [rrsig],
        keys: [unsupportedKey],
        authenticatedKeyIds: new Set([signerId(12, keyTag)]),
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'unsupported',
      reason: 'unsupported-algorithm',
    });
  });

  it('does not call an unsupported signature authenticated when its key is ineligible', () => {
    const signer = genKey(13);
    const nonZoneKey: DnskeyData = {
      ...signer.dnskey,
      flags: 0,
      algorithm: 12,
    };
    const keyTag = computeKeyTag(dnskeyRdata(nonZoneKey));
    const rrsig = {
      ...signARecordRrset(ownerName, records, signerName, signer, win),
      algorithm: 12,
      keyTag,
    };

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [rrsig],
        keys: [nonZoneKey],
        authenticatedKeyIds: new Set([signerId(12, keyTag)]),
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'bogus',
      reason: 'invalid-signature',
    });
  });

  it('reports an expired unsupported signature as expired, not unsupported', () => {
    const signer = genKey(13);
    const unsupportedKey: DnskeyData = {
      ...signer.dnskey,
      algorithm: 12,
    };
    const keyTag = computeKeyTag(dnskeyRdata(unsupportedKey));
    const rrsig = {
      ...signARecordRrset(ownerName, records, signerName, signer, win),
      algorithm: 12,
      keyTag,
    };

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [rrsig],
        keys: [unsupportedKey],
        authenticatedKeyIds: new Set([signerId(12, keyTag)]),
        signerName,
        now: win.expiration + 1,
      }),
    ).toMatchObject({
      status: 'bogus',
      reason: 'expired',
    });
  });

  it('does not let an in-window unsupported signature mask an expired supported one', () => {
    const signer = genKey(13);
    const unsupportedKey: DnskeyData = {
      ...signer.dnskey,
      algorithm: 12,
    };
    const supportedTag = computeKeyTag(dnskeyRdata(signer.dnskey));
    const unsupportedTag = computeKeyTag(dnskeyRdata(unsupportedKey));
    const expiredSupported = signARecordRrset(
      ownerName,
      records,
      signerName,
      signer,
      { inception: 100, expiration: 200 },
    );
    const inWindowUnsupported = {
      ...signARecordRrset(ownerName, records, signerName, signer, win),
      algorithm: 12,
      keyTag: unsupportedTag,
    };

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [inWindowUnsupported, expiredSupported],
        keys: [signer.dnskey, unsupportedKey],
        authenticatedKeyIds: new Set([
          signerId(13, supportedTag),
          signerId(12, unsupportedTag),
        ]),
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'bogus',
      reason: 'expired',
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
        authenticatedKeyIds: new Set<string>(),
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
        authenticatedKeyIds: new Set([signerId(13, keyTag)]),
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
