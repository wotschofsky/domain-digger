import {
  sign as cryptoSign,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';

import type { DnskeyData, RrsigData } from 'dns-packet';

import { dnskeyKeyTag, dnskeyRdata, wireName } from './wire';

// Signing-side test helpers: generated keypairs plus canonical RRSIG
// construction (RFC 4034 §3.1.8.1 / §6), so tests can exercise the real verify
// path for keys we hold the private half of. The RRSIG prefix and the RR
// framing are encoded here independently of the verifier, so a bug in those
// cannot pass on both sides. Name encoding, DNSKEY RDATA and the
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

// Sign a zone's DNSKEY RRset with `signer`. `rrset` is every DNSKEY at the apex.
export const signDnskeyRrset = (
  name: string,
  rrset: DnskeyData[],
  signer: Signer,
  opts: {
    inception: number;
    expiration: number;
    // Defaults to the owner's label count.
    labels?: number;
  },
): RrsigData => {
  const type = 48; // DNSKEY
  const ttl = 3600;
  const { algorithm } = signer.dnskey;
  const keyTag = dnskeyKeyTag(signer.dnskey);
  const labels = opts.labels ?? name.split('.').filter(Boolean).length;
  const prefix = Buffer.concat([
    u16(type),
    Buffer.from([algorithm, labels]),
    u32(ttl),
    u32(opts.expiration),
    u32(opts.inception),
    u16(keyTag),
    wireName(name),
  ]);
  const owner = wireName(name);
  const records = rrset
    .map((key) => dnskeyRdata(key))
    .sort(Buffer.compare)
    .map((rdata) =>
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
    typeCovered: 'DNSKEY',
    algorithm,
    labels,
    originalTTL: ttl,
    expiration: opts.expiration,
    inception: opts.inception,
    keyTag,
    signersName: name,
    signature: signData(signer, Buffer.concat([prefix, ...records])),
  };
};
