import type { DnskeyData } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import { validatePositiveRrset } from './rrset';
import { genKey, signARecordRrset } from './test-helpers';
import { dnskeyKeyTag } from './wire';

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
    const keyTag = dnskeyKeyTag(signer.dnskey);

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [rrsig],
        keys: [signer.dnskey],
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
    const zskTag = dnskeyKeyTag(zskRecord);

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [rrsig],
        keys: [ksk.dnskey, zskRecord],
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

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [],
        keys: [signer.dnskey],
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

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [rrsig],
        keys: [signer.dnskey],
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
    const keyTag = dnskeyKeyTag(unsupportedKey);
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
    const keyTag = dnskeyKeyTag(nonZoneKey);
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
        signerName,
        now,
      }),
    ).toMatchObject({
      // A key without the ZONE flag may not sign at all, so its signature is
      // noise from an untrusted signer -- bogus, never "unsupported".
      status: 'bogus',
      reason: 'unauthenticated-signer',
    });
  });

  it('reports an expired unsupported signature as expired, not unsupported', () => {
    const signer = genKey(13);
    const unsupportedKey: DnskeyData = {
      ...signer.dnskey,
      algorithm: 12,
    };
    const keyTag = dnskeyKeyTag(unsupportedKey);
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
        signerName,
        now: win.expiration + 1,
      }),
    ).toMatchObject({
      status: 'bogus',
      reason: 'expired',
    });
  });

  it('reports the longest-lived expiry when several signatures verify', () => {
    const signer = genKey(13);
    const shortLived = signARecordRrset(
      ownerName,
      records,
      signerName,
      signer,
      {
        inception: 1000,
        expiration: 1800,
      },
    );
    const longLived = signARecordRrset(ownerName, records, signerName, signer, {
      inception: 1000,
      expiration: 3000,
    });

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [shortLived, longLived],
        keys: [signer.dnskey],
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'secure',
      reason: 'validated',
      signatureExpiresAt: 3000,
    });
  });

  it('marks wildcard-expanded answers inconclusive without a denial proof', () => {
    const signer = genKey(13);
    // Signed at the wildcard owner: valid crypto, but proving it applies to
    // www.example also needs an NSEC/NSEC3 proof that no closer name exists.
    const wildcardSig = signARecordRrset(
      '*.example',
      records,
      signerName,
      signer,
      win,
    );

    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName,
        records,
        rrsigs: [wildcardSig],
        keys: [signer.dnskey],
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'indeterminate',
      reason: 'wildcard-no-denial-proof',
    });

    // Asking about the wildcard owner itself needs no expansion proof.
    expect(
      validatePositiveRrset({
        type: 'A',
        ownerName: '*.example',
        records,
        rrsigs: [wildcardSig],
        keys: [signer.dnskey],
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'secure',
      reason: 'validated',
    });
  });

  it('reports the same failure reason regardless of signature order', () => {
    const signer = genKey(13);
    const expired = signARecordRrset(ownerName, records, signerName, signer, {
      inception: 100,
      expiration: 200,
    });
    const tampered = signARecordRrset(
      ownerName,
      records,
      signerName,
      signer,
      win,
    );
    tampered.signature = Buffer.from(tampered.signature);
    tampered.signature[0] ^= 0xff;

    for (const rrsigs of [
      [expired, tampered],
      [tampered, expired],
    ]) {
      expect(
        validatePositiveRrset({
          type: 'A',
          ownerName,
          records,
          rrsigs,
          keys: [signer.dnskey],
          signerName,
          now,
        }),
      ).toMatchObject({
        status: 'bogus',
        reason: 'expired',
        signatureExpiresAt: 200,
      });
    }
  });

  it('does not let an in-window unsupported signature mask an expired supported one', () => {
    const signer = genKey(13);
    const unsupportedKey: DnskeyData = {
      ...signer.dnskey,
      algorithm: 12,
    };
    const unsupportedTag = dnskeyKeyTag(unsupportedKey);
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
        // The zone's authenticated key set does not contain the signer.
        keys: [genKey(13).dnskey],
        signerName,
        now,
      }),
    ).toMatchObject({
      status: 'bogus',
      reason: 'unauthenticated-signer',
    });
  });

  describe('CNAME RRsets', () => {
    const cname = (target: string) => ({
      type: 'CNAME',
      ownerName,
      records: [{ name: ownerName, type: 'CNAME', data: target }],
      rrsigs: [],
      keys: [genKey(13).dnskey],
      signerName,
      now,
    });

    it('surfaces the alias target, normalized', () => {
      expect(validatePositiveRrset(cname('Target.Example.'))).toMatchObject({
        reason: 'missing-rrsig',
        cnameTarget: 'target.example',
      });
    });

    it('excuses a missing RRSIG only for the exact DNAME substitution', () => {
      // RFC 6672 §2.2: www.example + DNAME example -> example.net synthesizes
      // www.example.net, which is legitimately unsigned.
      const dname = { name: 'Example.', target: 'example.net' };

      expect(
        validatePositiveRrset({
          ...cname('www.example.net.'),
          dnames: [dname],
        }),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'dname-synthesized',
        cnameTarget: 'www.example.net',
      });

      for (const unrelated of [
        // A different target than the substitution would produce.
        { ...cname('cdn.example.net'), dnames: [dname] },
        // A DNAME that does not own the queried name.
        {
          ...cname('www.example.net'),
          dnames: [{ name: 'other.example', target: 'example.net' }],
        },
        // The DNAME owner itself is not redirected, only names below it.
        {
          ...cname('example.net'),
          ownerName: 'example',
          records: [{ name: 'example', type: 'CNAME', data: 'example.net' }],
          dnames: [dname],
        },
      ]) {
        expect(validatePositiveRrset(unrelated)).toMatchObject({
          status: 'unsigned',
          reason: 'missing-rrsig',
        });
      }
    });
  });

  it('reports absent positive RRsets without pretending to prove denial', () => {
    const signer = genKey(13);

    expect(
      validatePositiveRrset({
        type: 'MX',
        ownerName,
        records: [],
        rrsigs: [],
        keys: [signer.dnskey],
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
