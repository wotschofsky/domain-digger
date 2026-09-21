import {
  sign as cryptoSign,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';

import type { DnskeyData, DsData, RrsigData } from 'dns-packet';

import { dsDigest } from './ds';
import { dnskeyKeyTag, dnskeyRdata, wireName } from './wire';

// Signing-side test helpers: generated keypairs plus canonical RRSIG
// construction (RFC 4034 §3.1.8.1 / §6), so tests can exercise the real verify
// path for keys we hold the private half of. The RRSIG prefix, the RR framing
// and the DS / A RDATA are encoded here independently of the verifier, so a
// bug in those cannot pass on both sides. Name encoding, DNSKEY RDATA and the
// key tag are shared with wire.ts; the captured real-world records in
// test-vectors.ts are what prove those against independent signers.

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
  keyTag: dnskeyKeyTag(key),
  algorithm: key.algorithm,
  digestType: 2,
  digest: dsDigest(name, key, 2)!,
});

// A live keypair whose DNSKEY we can sign with.
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

type Signer = { priv: KeyObject; dnskey: DnskeyData };

export const signData = (signer: Signer, data: Buffer): Buffer =>
  signer.dnskey.algorithm === 15
    ? cryptoSign(null, data, signer.priv)
    : signer.dnskey.algorithm === 13
      ? cryptoSign('sha256', data, {
          key: signer.priv,
          dsaEncoding: 'ieee-p1363',
        })
      : cryptoSign('sha256', data, signer.priv);

const TYPE_CODES = { A: 1, DS: 43, DNSKEY: 48 } as const;

/** One RRSIG over `rdatas`, the RRset of `typeCovered` at `ownerName`. */
const signRrset = (params: {
  typeCovered: keyof typeof TYPE_CODES;
  ttl: number;
  ownerName: string;
  rdatas: Buffer[];
  signerName: string;
  signer: Signer;
  inception: number;
  expiration: number;
  // Defaults to the owner's label count (not counting a leading wildcard).
  labels?: number;
  // The owner the signature is computed over, when it differs from
  // `ownerName` -- the wildcard an answer was expanded from.
  signedOwnerName?: string;
}): RrsigData => {
  const { typeCovered, ttl, ownerName, signerName, signer } = params;
  const { algorithm } = signer.dnskey;
  const keyTag = dnskeyKeyTag(signer.dnskey);
  const ownerLabels = ownerName.split('.').filter(Boolean);
  const labels =
    params.labels ?? ownerLabels.length - (ownerLabels[0] === '*' ? 1 : 0);
  const type = TYPE_CODES[typeCovered];
  const prefix = Buffer.concat([
    u16(type),
    Buffer.from([algorithm, labels]),
    u32(ttl),
    u32(params.expiration),
    u32(params.inception),
    u16(keyTag),
    wireName(signerName),
  ]);
  const owner = wireName(params.signedOwnerName ?? ownerName);
  const rrset = [...params.rdatas].sort(Buffer.compare).map((rdata) =>
    Buffer.concat([
      owner,
      u16(type),
      u16(1), // class IN
      u32(ttl),
      u16(rdata.length),
      rdata,
    ]),
  );
  return {
    typeCovered,
    algorithm,
    labels,
    originalTTL: ttl,
    expiration: params.expiration,
    inception: params.inception,
    keyTag,
    signersName: signerName,
    signature: signData(signer, Buffer.concat([prefix, ...rrset])),
  };
};

// Sign a zone's DNSKEY RRset with `signer`. `rrset` is every DNSKEY at the apex.
export const signDnskeyRrset = (
  name: string,
  rrset: DnskeyData[],
  signer: Signer,
  opts: { inception: number; expiration: number; labels?: number },
): RrsigData =>
  signRrset({
    typeCovered: 'DNSKEY',
    ttl: 3600,
    ownerName: name,
    rdatas: rrset.map((key) => dnskeyRdata(key)),
    signerName: name,
    signer,
    ...opts,
  });

// DS RDATA (RFC 4034 §5.1): keyTag(2) | algorithm(1) | digestType(1) | digest.
const dsRdata = (record: DsData): Buffer =>
  Buffer.concat([
    u16(record.keyTag),
    Buffer.from([record.algorithm, record.digestType]),
    record.digest,
  ]);

export const signDsRrset = (
  ownerName: string,
  records: DsData[],
  signerName: string,
  signer: Signer,
  opts: { inception: number; expiration: number },
): RrsigData =>
  signRrset({
    typeCovered: 'DS',
    ttl: 3600,
    ownerName,
    rdatas: records.map(dsRdata),
    signerName,
    signer,
    ...opts,
  });

const aRdata = (ip: string): Buffer => Buffer.from(ip.split('.').map(Number));

export const signARecordRrset = (
  ownerName: string,
  records: Array<{ name: string; type: 'A'; data: string }>,
  signerName: string,
  signer: Signer,
  opts: {
    inception: number;
    expiration: number;
    labels?: number;
    signedOwnerName?: string;
  },
): RrsigData =>
  signRrset({
    typeCovered: 'A',
    ttl: 300,
    ownerName,
    rdatas: records.map((record) => aRdata(record.data)),
    signerName,
    signer,
    ...opts,
  });
