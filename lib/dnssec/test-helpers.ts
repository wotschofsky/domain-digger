import {
  sign as cryptoSign,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';

import type { DnskeyData, DsData, RrsigData } from 'dns-packet';

import { dsDigest } from './ds';
import { canonicalRdata, computeKeyTag, dnskeyRdata, wireName } from './wire';

// Signing-side test helpers: generated keypairs plus canonical RRSIG
// construction, mirroring the encoding in wire.ts (RFC 4034 §3.1.8.1 / §6) so
// tests can exercise the real verify path. Captured real-world records live in
// test-vectors.ts.

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

export const dsForKey = (name: string, key: DnskeyData): DsData => ({
  keyTag: computeKeyTag(dnskeyRdata(key)),
  algorithm: key.algorithm,
  digestType: 2,
  digest: dsDigest(name, key, 2)!,
});

// A live keypair whose DNSKEY we can sign with -- lets tests exercise the real
// verify path (buildChain propagation, expiry, forgery) for keys we hold the
// private half of. The golden vectors in test-vectors.ts independently prove
// the canonical encoding against real-world signers, so a shared bug between
// this signer and the verifier could not pass both.
export const genKey = (
  algorithm: number,
): { priv: KeyObject; dnskey: DnskeyData } => {
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

const signData = (
  signer: { priv: KeyObject; dnskey: DnskeyData },
  data: Buffer,
): Buffer =>
  signer.dnskey.algorithm === 15
    ? cryptoSign(null, data, signer.priv)
    : signer.dnskey.algorithm === 13
      ? cryptoSign('sha256', data, {
          key: signer.priv,
          dsaEncoding: 'ieee-p1363',
        })
      : cryptoSign('sha256', data, signer.priv);

// Sign a zone's DNSKEY RRset with `signer`. `rrset` is every DNSKEY at the apex.
export const signDnskeyRrset = (
  name: string,
  rrset: DnskeyData[],
  signer: { priv: KeyObject; dnskey: DnskeyData },
  opts: { inception: number; expiration: number; labels?: number },
): RrsigData => {
  const { algorithm } = signer.dnskey;
  const keyTag = computeKeyTag(dnskeyRdata(signer.dnskey));
  const labels = opts.labels ?? name.split('.').filter(Boolean).length;
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
  return {
    typeCovered: 'DNSKEY',
    algorithm,
    labels,
    originalTTL: 3600,
    expiration: opts.expiration,
    inception: opts.inception,
    keyTag,
    signersName: name,
    signature: signData(signer, Buffer.concat([prefix, ...rrs])),
  };
};

export const signDsRrset = (
  ownerName: string,
  records: DsData[],
  signerName: string,
  signer: { priv: KeyObject; dnskey: DnskeyData },
  opts: { inception: number; expiration: number },
): RrsigData => {
  const { algorithm } = signer.dnskey;
  const keyTag = computeKeyTag(dnskeyRdata(signer.dnskey));
  const labels = ownerName.split('.').filter(Boolean).length;
  const prefix = Buffer.concat([
    u16(43),
    Buffer.from([algorithm, labels]),
    u32(3600),
    u32(opts.expiration),
    u32(opts.inception),
    u16(keyTag),
    wireName(signerName),
  ]);
  const rrset = records
    .map((record) => canonicalRdata('DS', record))
    .filter((rdata): rdata is Buffer => rdata !== null)
    .sort(Buffer.compare)
    .map((rdata) =>
      Buffer.concat([
        wireName(ownerName),
        u16(43),
        u16(1),
        u32(3600),
        u16(rdata.length),
        rdata,
      ]),
    );
  return {
    typeCovered: 'DS',
    algorithm,
    labels,
    originalTTL: 3600,
    expiration: opts.expiration,
    inception: opts.inception,
    keyTag,
    signersName: signerName,
    signature: signData(signer, Buffer.concat([prefix, ...rrset])),
  };
};

const aRdata = (ip: string): Buffer => Buffer.from(ip.split('.').map(Number));

export const signARecordRrset = (
  ownerName: string,
  records: Array<{ name: string; type: 'A'; data: string }>,
  signerName: string,
  signer: { priv: KeyObject; dnskey: DnskeyData },
  opts: {
    inception: number;
    expiration: number;
    labels?: number;
    signedOwnerName?: string;
  },
): RrsigData => {
  const { algorithm } = signer.dnskey;
  const keyTag = computeKeyTag(dnskeyRdata(signer.dnskey));
  const ownerLabels = ownerName.split('.').filter(Boolean);
  const labels =
    opts.labels ?? ownerLabels.length - (ownerLabels[0] === '*' ? 1 : 0);
  const signedOwnerName = opts.signedOwnerName ?? ownerName;
  const prefix = Buffer.concat([
    u16(1),
    Buffer.from([algorithm, labels]),
    u32(300),
    u32(opts.expiration),
    u32(opts.inception),
    u16(keyTag),
    wireName(signerName),
  ]);
  const rrset = records
    .map((record) => aRdata(record.data))
    .sort(Buffer.compare)
    .map((rdata) =>
      Buffer.concat([
        wireName(signedOwnerName),
        u16(1), // type A
        u16(1), // class IN
        u32(300),
        u16(rdata.length),
        rdata,
      ]),
    );
  return {
    typeCovered: 'A',
    algorithm,
    labels,
    originalTTL: 300,
    expiration: opts.expiration,
    inception: opts.inception,
    keyTag,
    signersName: signerName,
    signature: signData(signer, Buffer.concat([prefix, ...rrset])),
  };
};
