import {
  createHash,
  createPublicKey,
  verify as cryptoVerify,
} from 'node:crypto';

import dnsPacket, {
  type DnskeyData,
  type DsData,
  type RrsigData,
} from 'dns-packet';

// WHAT THIS VERIFIES: the DNSSEC authentication chain, two ways per zone.
// (1) Digest linkage (RFC 4034 §5.1.4): the parent's DS record actually hashes
//     to one of the child zone's DNSKEYs, anchored at the root by the IANA
//     trust anchor. (2) Key-set signature (RFC 4034 §3.1.8.1): the RRSIG over
//     each zone's DNSKEY RRset cryptographically verifies against the DS-linked
//     KSK and is within its inception/expiration window. Together these prove
//     the zone's key set is authentic AND currently, validly signed -- so an
//     expired or forged key-set signature (the most common real DNSSEC outage)
//     is caught and marked broken, not shown as secure.
//
// WHAT IT STILL DOES NOT VERIFY (documented limitations, shown on the page):
//   - Per-RRset data signatures below the DNSKEY RRset. We confirm each zone's
//     *keys* are validly signed, then separately validate positive leaf RRsets
//     that exist for common record types. Negative answers are not validated.
//   - NSEC/NSEC3 denial-of-existence proofs (authenticated negative answers).
//   - Unsigned *delegations* below the registered domain: a queried name that is
//     itself a separate, unsigned sub-delegation is shown via its nearest signed
//     ancestor zone rather than flagged insecure. Telling that apart from a name
//     simply covered by its parent zone needs NS zone-cut probing plus an NSEC
//     proof that no DS exists -- both beyond this check.
//
// NSEC/NSEC3 proof validation is left as a future improvement.

export type DnssecStatus = 'secure' | 'insecure' | 'broken';

export type DnssecRrsetStatus =
  | 'secure'
  | 'unsigned'
  | 'bogus'
  | 'unsupported'
  | 'absent'
  | 'indeterminate';

export type DnssecRrsetReason =
  | 'validated'
  | 'no-records'
  | 'missing-rrsig'
  | 'unsupported-type'
  | 'unsupported-rdata'
  | 'unauthenticated-signer'
  | 'expired'
  | 'not-yet-valid'
  | 'invalid-signature'
  | 'lookup-failed';

export type DnssecRrset = {
  type: string;
  status: DnssecRrsetStatus;
  reason: DnssecRrsetReason;
  recordCount: number;
  signerName?: string;
  signerKeyTag?: number;
  signerAlgorithmName?: string;
  signatureInceptionAt?: number;
  signatureExpiresAt?: number;
  signatureOriginalTtl?: number;
};

type DnssecAnswerRecord = {
  name: string;
  type: string;
  data: unknown;
};

export type DnssecKey = {
  keyTag: number;
  algorithm: number;
  algorithmName: string;
  flags: number;
  isSep: boolean; // Secure Entry Point (KSK) -- signs the DNSKEY RRset
  isRevoked: boolean;
  linked: boolean; // a parent DS / trust anchor matches this key
  bits: number | null; // key strength in bits (RSA modulus / curve size)
  deprecated: boolean; // uses a deprecated/weak signing algorithm
};

export type DnssecDs = {
  keyTag: number;
  algorithm: number;
  algorithmName: string;
  digestType: number;
  digestName: string;
  digestHex: string; // the DS digest, uppercase hex (a key fingerprint)
  matched: boolean; // this DS hashes to one of the zone's DNSKEYs
  weakDigest: boolean; // uses a deprecated digest (SHA-1 / GOST)
};

export type DnssecZone = {
  name: string; // '.', 'dev', 'wsky.dev'
  keys: DnssecKey[];
  dsRecords: DnssecDs[]; // DS published by the parent (or the root trust anchor)
  status: DnssecStatus;
  // Why the chain could not continue at this zone, for a precise verdict
  // message. Undefined for secure zones and plain unsigned delegations.
  //   'no-dnskey'     : parent published a DS but the zone serves no DNSKEY.
  //   'ds-mismatch'   : the DS authenticates none of the served keys (digest).
  //   'bad-signature' : keys link by digest, but the RRSIG over the DNSKEY RRset
  //                     is missing, expired, or fails to verify (bogus/expired).
  //   'unsupported-algorithm' : this validator supports none of the DS digest /
  //                     signing algorithms, so the zone is unvalidatable and
  //                     treated as insecure, not bogus (RFC 4035 §5.2).
  breakReason?:
    | 'no-dnskey'
    | 'ds-mismatch'
    | 'bad-signature'
    | 'unsupported-algorithm';
  // Earliest RRSIG expiry (Unix seconds) across the leaf's signed RRsets.
  // Expiring/expired signatures are the most common real DNSSEC outage.
  signatureExpiresAt?: number;
  // Positive leaf RRsets that were probed and validated. Absent RRsets are kept
  // in the model so the UI can distinguish "not present" from "not checked".
  rrsets?: DnssecRrset[];
};

export type DnssecChain = {
  zones: DnssecZone[];
  overall: DnssecStatus;
};

/** Raw per-zone records collected by the resolver, ordered root -> leaf. */
export type RawZone = {
  name: string;
  keys: DnskeyData[];
  dsRecords: DsData[];
  // RRSIG records covering this zone's DNSKEY RRset (typeCovered === 'DNSKEY').
  // Used to cryptographically verify the key set is validly signed by its KSK.
  keyRrsigs?: RrsigData[];
};

// IANA root zone trust anchors: KSK-2017 and its successor KSK-2024, both
// currently valid (https://data.iana.org/root-anchors/root-anchors.xml).
// Carrying both means the verdict survives the root KSK rollover -- with only
// KSK-2017 pinned, the first root DNSKEY RRset signed by KSK-2024 would render
// every domain "broken".
export const ROOT_TRUST_ANCHORS: DsData[] = [
  {
    keyTag: 20326, // KSK-2017
    algorithm: 8, // RSASHA256
    digestType: 2, // SHA-256
    digest: Buffer.from(
      'E06D44B80B8F1D39A95C0B0D7C65D08458E880409BBC683457104237C7F8EC8D',
      'hex',
    ),
  },
  {
    keyTag: 38696, // KSK-2024
    algorithm: 8, // RSASHA256
    digestType: 2, // SHA-256
    digest: Buffer.from(
      '683D2D0ACB8C9B712A1948B27F741219298D0A450D612C483AF444A4C0FB2B16',
      'hex',
    ),
  },
];

export const ALGORITHM_NAMES: Record<number, string> = {
  1: 'RSAMD5',
  3: 'DSA',
  5: 'RSASHA1',
  6: 'DSA-NSEC3-SHA1',
  7: 'RSASHA1-NSEC3-SHA1',
  8: 'RSASHA256',
  10: 'RSASHA512',
  12: 'ECC-GOST',
  13: 'ECDSAP256SHA256',
  14: 'ECDSAP384SHA384',
  15: 'ED25519',
  16: 'ED448',
};

const algorithmName = (algorithm: number): string =>
  ALGORITHM_NAMES[algorithm] ?? `Algorithm ${algorithm}`;

export const DIGEST_NAMES: Record<number, string> = {
  1: 'SHA-1',
  2: 'SHA-256',
  3: 'GOST R 34.11-94',
  4: 'SHA-384',
};

const DIGEST_HASH_ALGOS: Record<number, string> = {
  1: 'sha1',
  2: 'sha256',
  4: 'sha384',
};

const RR_TYPE: Record<string, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  NAPTR: 35,
  DNSKEY: 48,
  CAA: 257,
};

// Signing algorithms no longer considered safe: RSAMD5, DSA, RSASHA1 (incl.
// the NSEC3 variant), DSA-NSEC3-SHA1, ECC-GOST. RFC 8624 marks these MUST NOT
// / NOT RECOMMENDED for signing.
const DEPRECATED_ALGORITHMS = new Set([1, 3, 5, 6, 7, 12]);

// DS digest algorithms no longer considered safe: SHA-1 and GOST.
const WEAK_DIGEST_TYPES = new Set([1, 3]);

const RSA_ALGORITHMS = new Set([1, 5, 7, 8, 10]);

// Signing algorithms this validator can actually verify (see
// dnskeyToPublicKey). A DS pointing at anything else must make the zone
// insecure, not bogus (RFC 4035 §5.2). RSAMD5 (1) is excluded: it uses a
// different key-tag algorithm (RFC 4034 App. B.1) and has no verify path here.
const SUPPORTED_SIGNING_ALGORITHMS = new Set([5, 7, 8, 10, 13, 14, 15, 16]);

// Security parameter (in bits) for the fixed-size elliptic-curve / EdDSA
// algorithms, keyed by DNSSEC algorithm number.
const CURVE_BITS: Record<number, number> = {
  13: 256, // ECDSA P-256
  14: 384, // ECDSA P-384
  15: 256, // Ed25519
  16: 456, // Ed448
};

export function isDeprecatedAlgorithm(algorithm: number): boolean {
  return DEPRECATED_ALGORITHMS.has(algorithm);
}

/**
 * Whether a key's strength is considered weak. The 2048-bit floor only applies
 * to RSA moduli -- fixed-size curve algorithms (P-256, Ed25519, ...) are strong
 * at their nominal size and must not be judged by RSA thresholds.
 */
export function isWeakKey(key: Pick<DnssecKey, 'algorithm' | 'bits'>): boolean {
  return (
    RSA_ALGORITHMS.has(key.algorithm) && key.bits !== null && key.bits < 2048
  );
}

export function isWeakDigest(digestType: number): boolean {
  return WEAK_DIGEST_TYPES.has(digestType);
}

/**
 * Key strength in bits. For RSA this is the modulus length parsed from the
 * RFC 3110 public-key wire format (1-byte exponent length, or 0 + 2-byte length
 * for long exponents, then exponent, then modulus). For ECDSA/EdDSA it is the
 * curve's security parameter. Null for unknown algorithms.
 */
export function keyBits(
  key: Pick<DnskeyData, 'algorithm' | 'key'>,
): number | null {
  if (key.algorithm in CURVE_BITS) return CURVE_BITS[key.algorithm];
  if (!RSA_ALGORITHMS.has(key.algorithm)) return null;

  const parts = rsaKeyParts(key.key);
  return parts ? parts.modulus.length * 8 : null;
}

/** Canonical wire-format encoding of a domain name (lowercase, length-prefixed). */
export function wireName(name: string): Buffer {
  const clean = name.replace(/\.$/, '');
  if (clean === '') return Buffer.from([0]); // root
  const parts: Buffer[] = [];
  for (const label of clean.toLowerCase().split('.')) {
    const labelBuf = Buffer.from(label, 'ascii');
    parts.push(Buffer.from([labelBuf.length]), labelBuf);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

/** DNSKEY RDATA wire format: flags(2) | protocol(1, always 3) | algorithm(1) | publicKey. */
export function dnskeyRdata(
  key: Pick<DnskeyData, 'flags' | 'algorithm' | 'key'>,
): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt16BE(key.flags, 0);
  head.writeUInt8(3, 2);
  head.writeUInt8(key.algorithm, 3);
  return Buffer.concat([head, key.key]);
}

/** Key tag computation per RFC 4034 Appendix B (general case). */
/**
 * Identity used to gate trusted signers. The 16-bit key tag alone can collide
 * across algorithms, so trust decisions pair it with the algorithm number.
 */
export const signerId = (algorithm: number, keyTag: number): string =>
  `${algorithm}:${keyTag}`;

export function computeKeyTag(rdata: Buffer): number {
  let ac = 0;
  for (let i = 0; i < rdata.length; i++) {
    ac += i & 1 ? rdata[i] : rdata[i] << 8;
  }
  ac += (ac >> 16) & 0xffff;
  return ac & 0xffff;
}

/** DS digest of a DNSKEY: hash(ownerName || DNSKEY RDATA). Null if digest type unsupported. */
export function dsDigest(
  zoneName: string,
  key: Pick<DnskeyData, 'flags' | 'algorithm' | 'key'>,
  digestType: number,
): Buffer | null {
  const algo = DIGEST_HASH_ALGOS[digestType];
  if (!algo) return null;
  return createHash(algo)
    .update(Buffer.concat([wireName(zoneName), dnskeyRdata(key)]))
    .digest();
}

/**
 * Whether a DS record authenticates a given DNSKEY of a zone. Following the
 * validator selection rule (RFC 4035 §5.2), the DS must agree with the DNSKEY on
 * algorithm and key tag before the digest is verified -- a real resolver picks
 * candidate keys by tag/algorithm and never reaches the digest for a DS whose
 * tag is wrong, so a malformed DS (right digest, wrong tag) is correctly treated
 * as a non-match here too.
 */
export function dsMatchesKey(
  ds: DsData,
  key: DnskeyData,
  zoneName: string,
): boolean {
  if (ds.algorithm !== key.algorithm) return false;
  if (ds.keyTag !== computeKeyTag(dnskeyRdata(key))) return false;
  const digest = dsDigest(zoneName, key, ds.digestType);
  return digest !== null && digest.equals(ds.digest);
}

// --- RRSIG signature verification (RFC 4034 §3.1.8.1) -----------------------

// Digest used by each signing algorithm's RRSIG (EdDSA hashes internally).
const HASH_BY_ALGORITHM: Record<number, string> = {
  5: 'sha1', // RSASHA1
  7: 'sha1', // RSASHA1-NSEC3-SHA1
  8: 'sha256', // RSASHA256
  10: 'sha512', // RSASHA512
  13: 'sha256', // ECDSAP256SHA256
  14: 'sha384', // ECDSAP384SHA384
};

const EC_CURVE_NAME: Record<number, string> = { 13: 'P-256', 14: 'P-384' };
const EC_COORD_BYTES: Record<number, number> = { 13: 32, 14: 48 };

/** Split an RFC 3110 RSA public key into its exponent and modulus. */
function rsaKeyParts(
  key: Buffer,
): { exponent: Buffer; modulus: Buffer } | null {
  if (key.length < 1) return null;
  let offset: number;
  let expLen = key[0];
  if (expLen === 0) {
    if (key.length < 3) return null;
    expLen = key.readUInt16BE(1);
    offset = 3;
  } else {
    offset = 1;
  }
  const exponent = key.subarray(offset, offset + expLen);
  const modulus = key.subarray(offset + expLen);
  if (exponent.length === 0 || modulus.length === 0) return null;
  return { exponent, modulus };
}

/**
 * Turn a DNSKEY's wire-format public key into a node crypto public key, via JWK
 * so no DER hand-encoding is needed. Returns null for unsupported/malformed keys
 * (e.g. Ed448 where the runtime lacks support) -- a null key can never verify,
 * so the zone is treated as unvalidated rather than trusted.
 */
export function dnskeyToPublicKey(
  algorithm: number,
  key: Buffer,
): ReturnType<typeof createPublicKey> | null {
  if (!SUPPORTED_SIGNING_ALGORITHMS.has(algorithm)) return null;
  try {
    if (RSA_ALGORITHMS.has(algorithm)) {
      const parts = rsaKeyParts(key);
      if (!parts) return null;
      return createPublicKey({
        key: {
          kty: 'RSA',
          n: parts.modulus.toString('base64url'),
          e: parts.exponent.toString('base64url'),
        },
        format: 'jwk',
      });
    }
    if (algorithm === 13 || algorithm === 14) {
      const size = EC_COORD_BYTES[algorithm];
      if (key.length !== size * 2) return null;
      return createPublicKey({
        key: {
          kty: 'EC',
          crv: EC_CURVE_NAME[algorithm],
          x: key.subarray(0, size).toString('base64url'),
          y: key.subarray(size).toString('base64url'),
        },
        format: 'jwk',
      });
    }
    if (algorithm === 15 || algorithm === 16) {
      return createPublicKey({
        key: {
          kty: 'OKP',
          crv: algorithm === 15 ? 'Ed25519' : 'Ed448',
          x: key.toString('base64url'),
        },
        format: 'jwk',
      });
    }
  } catch {
    return null;
  }
  return null;
}

/** RRSIG RDATA up to (but excluding) the signature, per RFC 4034 §3.1.8.1. */
function rrsigSigningPrefix(rrsig: RrsigData): Buffer | null {
  const typeCovered = RR_TYPE[rrsig.typeCovered];
  if (typeCovered === undefined) return null;
  const head = Buffer.alloc(18);
  head.writeUInt16BE(typeCovered, 0);
  head.writeUInt8(rrsig.algorithm, 2);
  head.writeUInt8(rrsig.labels, 3);
  head.writeUInt32BE(rrsig.originalTTL >>> 0, 4);
  head.writeUInt32BE(rrsig.expiration >>> 0, 8);
  head.writeUInt32BE(rrsig.inception >>> 0, 12);
  head.writeUInt16BE(rrsig.keyTag, 16);
  // Signer's name in canonical (lowercase, uncompressed) wire form.
  return Buffer.concat([head, wireName(rrsig.signersName)]);
}

/** One canonical RR: owner | type | class(IN) | originalTTL | rdlen | rdata. */
function canonicalRr(
  owner: string,
  type: number,
  originalTTL: number,
  rdata: Buffer,
): Buffer {
  const head = Buffer.alloc(10);
  head.writeUInt16BE(type, 0);
  head.writeUInt16BE(1, 2); // class IN
  head.writeUInt32BE(originalTTL >>> 0, 4);
  head.writeUInt16BE(rdata.length, 8);
  return Buffer.concat([wireName(owner), head, rdata]);
}

const normalizeDomain = (name: string): string =>
  name.replace(/\.$/, '').toLowerCase();

const normalizeRdata = (type: string, data: unknown): unknown => {
  switch (type) {
    case 'NS':
    case 'CNAME':
      return typeof data === 'string' ? normalizeDomain(data) : data;
    case 'MX':
      return typeof data === 'object' && data !== null && 'exchange' in data
        ? {
            ...data,
            exchange: normalizeDomain(String(data.exchange)),
          }
        : data;
    case 'SOA':
      return typeof data === 'object' &&
        data !== null &&
        'mname' in data &&
        'rname' in data
        ? {
            ...data,
            mname: normalizeDomain(String(data.mname)),
            rname: normalizeDomain(String(data.rname)),
          }
        : data;
    case 'SRV':
      return typeof data === 'object' && data !== null && 'target' in data
        ? {
            ...data,
            target: normalizeDomain(String(data.target)),
          }
        : data;
    case 'NAPTR':
      return typeof data === 'object' && data !== null && 'replacement' in data
        ? {
            ...data,
            replacement: normalizeDomain(String(data.replacement)),
          }
        : data;
    default:
      return data;
  }
};

type DnsPacketRecordEncoder = {
  encode: ((data: unknown, buf?: Buffer, offset?: number) => Buffer) & {
    bytes: number;
  };
};

const dnsPacketRecord = (type: string): DnsPacketRecordEncoder =>
  (
    dnsPacket as unknown as {
      record: (recordType: string) => DnsPacketRecordEncoder;
    }
  ).record(type);

export function canonicalRdata(type: string, data: unknown): Buffer | null {
  if (type === 'DNSKEY') {
    const key = data as Partial<DnskeyData>;
    if (
      typeof key.flags !== 'number' ||
      typeof key.algorithm !== 'number' ||
      !Buffer.isBuffer(key.key)
    ) {
      return null;
    }
    return dnskeyRdata(key as DnskeyData);
  }

  if (RR_TYPE[type] === undefined) return null;

  try {
    const encoded = dnsPacketRecord(type).encode(normalizeRdata(type, data));
    return encoded.subarray(2);
  } catch {
    return null;
  }
}

const canonicalOwnerForRrsig = (
  ownerName: string,
  rrsig: RrsigData,
): string => {
  const clean = ownerName.replace(/\.$/, '').toLowerCase();
  const labels = clean ? clean.split('.') : [];
  if (rrsig.labels >= labels.length) return clean || '.';

  const suffix = labels.slice(labels.length - rrsig.labels).join('.');
  return suffix ? `*.${suffix}` : '*';
};

function verifySignature(
  algorithm: number,
  data: Buffer,
  signature: Buffer,
  publicKey: ReturnType<typeof createPublicKey>,
): boolean {
  try {
    // EdDSA is a one-shot verify with no separate hash.
    if (algorithm === 15 || algorithm === 16) {
      return cryptoVerify(null, data, publicKey, signature);
    }
    const hash = HASH_BY_ALGORITHM[algorithm];
    if (!hash) return false;
    // DNSSEC ECDSA signatures are raw r||s (IEEE P1363), not DER-wrapped.
    if (algorithm === 13 || algorithm === 14) {
      return cryptoVerify(
        hash,
        data,
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        signature,
      );
    }
    return cryptoVerify(hash, data, publicKey, signature);
  } catch {
    return false;
  }
}

/**
 * A 16-bit key tag is a checksum, not an identifier: distinct keys can share a
 * tag (and an attacker can craft one that does), so signer selection must try
 * every candidate matching the RRSIG's (algorithm, key tag) pair -- gating on
 * the pair alone would let a colliding key impersonate the real signer, and
 * picking only the first match would falsely reject the second of two
 * legitimately colliding keys. Keys carrying the REVOKE bit are excluded:
 * validators must not accept signatures from a key that revokes itself
 * (RFC 5011 §2.1).
 */
const signerCandidates = (keys: DnskeyData[], rrsig: RrsigData): DnskeyData[] =>
  keys.filter(
    (k) =>
      (k.flags & 0x0080) === 0 &&
      k.algorithm === rrsig.algorithm &&
      computeKeyTag(dnskeyRdata(k)) === rrsig.keyTag,
  );

const verifiedByAnyCandidate = (
  candidates: DnskeyData[],
  rrsig: RrsigData,
  signedData: Buffer,
): boolean =>
  candidates.some((signer) => {
    const publicKey = dnskeyToPublicKey(signer.algorithm, signer.key);
    return (
      publicKey !== null &&
      verifySignature(signer.algorithm, signedData, rrsig.signature, publicKey)
    );
  });

/**
 * Verify an RRSIG over a zone's DNSKEY RRset: the signature must be produced by
 * one of the trusted `signers` (matched by tag + algorithm; defaults to all of
 * `keys`), be within its validity window at `now` (Unix seconds), and
 * cryptographically check out over the canonical DNSKEY RRset (RFC 4034 §6).
 * The RRset is every DNSKEY in `keys`, sorted by canonical RDATA (§6.3).
 * Returns false on any failure -- expired, forged, unsupported algorithm, or
 * malformed key.
 */
export function verifyDnskeyRrsig(params: {
  rrsig: RrsigData;
  keys: DnskeyData[];
  ownerName: string;
  now: number;
  // Keys allowed to vouch for the RRset (e.g. only DS-linked ones). The
  // signature is still computed over the full `keys` RRset.
  signers?: DnskeyData[];
}): boolean {
  const { rrsig, keys, ownerName, now, signers } = params;
  if (rrsig.typeCovered !== 'DNSKEY') return false;
  // The signer of a zone's DNSKEY RRset must be the zone itself (RFC 4035
  // §5.3.1) -- validating resolvers reject a wrong Signer's Name even when the
  // signature bytes verify.
  if (normalizeDomain(rrsig.signersName) !== normalizeDomain(ownerName)) {
    return false;
  }
  if (now < rrsig.inception || now > rrsig.expiration) return false;

  const candidates = signerCandidates(signers ?? keys, rrsig);
  if (!candidates.length) return false;

  const prefix = rrsigSigningPrefix(rrsig);
  if (!prefix) return false;

  const rrset = keys
    .map((k) => dnskeyRdata(k))
    .sort(Buffer.compare)
    .map((rdata) =>
      canonicalRr(ownerName, RR_TYPE.DNSKEY, rrsig.originalTTL, rdata),
    );

  const signedData = Buffer.concat([prefix, ...rrset]);
  return verifiedByAnyCandidate(candidates, rrsig, signedData);
}

export function verifyRrsetRrsig(params: {
  rrsig: RrsigData;
  type: string;
  records: DnssecAnswerRecord[];
  ownerName: string;
  signerName: string;
  keys: DnskeyData[];
  now: number;
}): boolean {
  const { rrsig, type, records, ownerName, signerName, keys, now } = params;
  if (rrsig.typeCovered !== type) return false;
  if (normalizeDomain(rrsig.signersName) !== normalizeDomain(signerName)) {
    return false;
  }
  if (now < rrsig.inception || now > rrsig.expiration) return false;

  const rrType = RR_TYPE[type];
  if (rrType === undefined) return false;

  const candidates = signerCandidates(keys, rrsig);
  if (!candidates.length) return false;

  const prefix = rrsigSigningPrefix(rrsig);
  if (!prefix) return false;

  const signedOwner = canonicalOwnerForRrsig(ownerName, rrsig);
  const rrset = records
    .filter((record) => record.type === type)
    .map((record) => canonicalRdata(type, record.data))
    .filter((rdata): rdata is Buffer => rdata !== null)
    .sort(Buffer.compare)
    .map((rdata) => canonicalRr(signedOwner, rrType, rrsig.originalTTL, rdata));

  if (
    rrset.length !== records.filter((record) => record.type === type).length
  ) {
    return false;
  }

  const signedData = Buffer.concat([prefix, ...rrset]);
  return verifiedByAnyCandidate(candidates, rrsig, signedData);
}

export function validatePositiveRrset(params: {
  type: string;
  ownerName: string;
  records: DnssecAnswerRecord[];
  rrsigs: RrsigData[];
  keys: DnskeyData[];
  // signerId()s of the keys in the DS-authenticated DNSKEY RRset.
  authenticatedKeyIds: Set<string>;
  signerName: string;
  now?: number;
}): DnssecRrset {
  const {
    type,
    ownerName,
    records,
    rrsigs,
    keys,
    authenticatedKeyIds,
    signerName,
    now = Math.floor(Date.now() / 1000),
  } = params;
  const typeRecords = records.filter((record) => record.type === type);

  if (typeRecords.length === 0) {
    return { type, status: 'absent', reason: 'no-records', recordCount: 0 };
  }

  if (RR_TYPE[type] === undefined) {
    return {
      type,
      status: 'unsupported',
      reason: 'unsupported-type',
      recordCount: typeRecords.length,
    };
  }

  if (
    typeRecords.some((record) => canonicalRdata(type, record.data) === null)
  ) {
    return {
      type,
      status: 'unsupported',
      reason: 'unsupported-rdata',
      recordCount: typeRecords.length,
    };
  }

  const covering = rrsigs.filter((rrsig) => rrsig.typeCovered === type);
  if (covering.length === 0) {
    return {
      type,
      status: 'unsigned',
      reason: 'missing-rrsig',
      recordCount: typeRecords.length,
    };
  }

  let fallbackReason: DnssecRrsetReason = 'invalid-signature';
  for (const rrsig of covering) {
    if (!authenticatedKeyIds.has(signerId(rrsig.algorithm, rrsig.keyTag))) {
      fallbackReason = 'unauthenticated-signer';
      continue;
    }
    if (now < rrsig.inception) {
      fallbackReason = 'not-yet-valid';
      continue;
    }
    if (now > rrsig.expiration) {
      fallbackReason = 'expired';
      continue;
    }
    const verified = verifyRrsetRrsig({
      rrsig,
      type,
      records: typeRecords,
      ownerName,
      signerName,
      keys,
      now,
    });
    if (verified) {
      return {
        type,
        status: 'secure',
        reason: 'validated',
        recordCount: typeRecords.length,
        signerName: rrsig.signersName,
        signerKeyTag: rrsig.keyTag,
        signerAlgorithmName: algorithmName(rrsig.algorithm),
        signatureInceptionAt: rrsig.inception,
        signatureExpiresAt: rrsig.expiration,
        signatureOriginalTtl: rrsig.originalTTL,
      };
    }
  }

  const firstCovering = covering[0];
  return {
    type,
    status: 'bogus',
    reason: fallbackReason,
    recordCount: typeRecords.length,
    signerName: firstCovering?.signersName,
    signerKeyTag: firstCovering?.keyTag,
    signerAlgorithmName: firstCovering
      ? algorithmName(firstCovering.algorithm)
      : undefined,
    signatureInceptionAt: firstCovering?.inception,
    signatureExpiresAt: Math.min(...covering.map((rrsig) => rrsig.expiration)),
    signatureOriginalTtl: firstCovering?.originalTTL,
  };
}

/**
 * Whether the zone's DNSKEY RRset carries a valid, unexpired RRSIG made by a key
 * the parent DS (or root anchor) authenticates. Only DS-linked keys are trusted
 * signers: a zone must not vouch for its own key set with a key nothing above it
 * has authenticated. `keys` is the already-computed metadata (for `.linked`).
 */
function dnskeyRrsetSigned(
  zone: RawZone,
  keys: DnssecKey[],
  now: number,
): boolean {
  // Restrict signer candidates to the DS-linked keys themselves (by identity,
  // not by 16-bit tag): a colliding unanchored key must not be able to vouch
  // for the key set. `keys` is index-aligned with zone.keys.
  const linkedKeys = zone.keys.filter((_, i) => keys[i].linked);
  return (zone.keyRrsigs ?? []).some((rrsig) =>
    verifyDnskeyRrsig({
      rrsig,
      keys: zone.keys,
      ownerName: zone.name,
      now,
      signers: linkedKeys,
    }),
  );
}

/**
 * Walk the collected zones top-down and compute a per-zone and overall status.
 * `secure`   : DS (or root anchor) links a key AND every zone above is secure.
 * `insecure` : no DS from the parent -- unsigned / insecure delegation.
 * `broken`   : parent published a DS but the zone serves no matching key (bogus),
 *              including the case where it serves no DNSKEY at all.
 *
 * A zone is only `secure` when its keys link to the parent DS by digest AND the
 * RRSIG over its DNSKEY RRset verifies against a DS-linked key and is currently
 * valid (not expired) -- a linked-but-unsigned/expired key set is `broken`.
 *
 * Once the chain of trust ends, its reason propagates down: everything below an
 * unsigned delegation is `insecure` (unauthenticated, not bogus), and everything
 * below a bogus zone stays `broken`. A zone's own DS/DNSKEY state is only
 * consulted while the chain above it is still secure.
 *
 * `now` (Unix seconds) is the instant RRSIG validity is judged against; it
 * defaults to the current time and is injectable for deterministic tests.
 */
export function buildChain(
  zones: RawZone[],
  now: number = Math.floor(Date.now() / 1000),
): DnssecChain {
  const out: DnssecZone[] = [];
  // Trust state carried down the chain: 'secure' while intact, otherwise the
  // reason it ended ('insecure' for an unsigned cut, 'broken' for a bogus zone).
  let chain: DnssecStatus = 'secure';

  for (const zone of zones) {
    const isRoot = zone.name === '.' || zone.name === '';
    const anchors = isRoot ? ROOT_TRUST_ANCHORS : zone.dsRecords;

    const keys: DnssecKey[] = zone.keys.map((k) => {
      const rdata = dnskeyRdata(k);
      return {
        keyTag: computeKeyTag(rdata),
        algorithm: k.algorithm,
        algorithmName: algorithmName(k.algorithm),
        flags: k.flags,
        isSep: (k.flags & 0x0001) !== 0,
        isRevoked: (k.flags & 0x0080) !== 0,
        linked: anchors.some((ds) => dsMatchesKey(ds, k, zone.name)),
        bits: keyBits(k),
        deprecated: isDeprecatedAlgorithm(k.algorithm),
      };
    });

    const dsRecords: DnssecDs[] = anchors.map((ds) => ({
      keyTag: ds.keyTag,
      algorithm: ds.algorithm,
      algorithmName: algorithmName(ds.algorithm),
      digestType: ds.digestType,
      digestName: DIGEST_NAMES[ds.digestType] ?? `Digest ${ds.digestType}`,
      digestHex: ds.digest.toString('hex').toUpperCase(),
      matched: zone.keys.some((k) => dsMatchesKey(ds, k, zone.name)),
      weakDigest: isWeakDigest(ds.digestType),
    }));

    let status: DnssecStatus;
    let breakReason: DnssecZone['breakReason'];
    if (chain !== 'secure') {
      // The chain of trust already ended above this zone, so its own records are
      // unauthenticated. Propagate the reason: insecure below an unsigned cut,
      // broken below a bogus zone.
      status = chain;
    } else if (anchors.length === 0) {
      // No DS from the parent (nor a trust anchor): an unsigned / insecure
      // delegation. The chain is unsigned from here down regardless of whether
      // this zone serves its own keys.
      status = 'insecure';
    } else if (keys.length === 0) {
      // Parent vouches for this zone (DS present) but it serves no DNSKEY -> bogus.
      status = 'broken';
      breakReason = 'no-dnskey';
    } else if (!dsRecords.some((d) => d.matched)) {
      // A DS whose digest or signing algorithm this validator doesn't support
      // must be ignored, not scored as a mismatch: if no usable DS remains, the
      // zone is unvalidatable -> insecure, not bogus (RFC 4035 §5.2).
      if (
        anchors.some(
          (ds) =>
            ds.digestType in DIGEST_HASH_ALGOS &&
            SUPPORTED_SIGNING_ALGORITHMS.has(ds.algorithm),
        )
      ) {
        // DS present but authenticates none of the served keys -> bogus.
        status = 'broken';
        breakReason = 'ds-mismatch';
      } else {
        status = 'insecure';
        breakReason = 'unsupported-algorithm';
      }
    } else if (!dnskeyRrsetSigned(zone, keys, now)) {
      // Keys link by digest, but the RRSIG over the DNSKEY RRset is missing,
      // expired, or fails to verify -> the key set isn't validly signed (bogus).
      // Exception: if no DS-linked key even uses an algorithm this validator
      // implements (e.g. ECC-GOST), verification never ran -- the zone is
      // unvalidatable, not bogus. A linked key with a supported algorithm but
      // malformed key material stays bogus: that is a broken configuration,
      // not an unsupported one.
      if (
        zone.keys.some(
          (k, i) =>
            keys[i].linked && SUPPORTED_SIGNING_ALGORITHMS.has(k.algorithm),
        )
      ) {
        status = 'broken';
        breakReason = 'bad-signature';
      } else {
        status = 'insecure';
        breakReason = 'unsupported-algorithm';
      }
    } else {
      status = 'secure';
    }

    out.push({
      name: zone.name,
      keys,
      dsRecords,
      status,
      breakReason,
    });
    // The first non-secure zone fixes the descended trust state.
    if (chain === 'secure') chain = status;
  }

  const overall: DnssecStatus = out.some((z) => z.status === 'broken')
    ? 'broken'
    : out.every((z) => z.status === 'secure')
      ? 'secure'
      : 'insecure';

  return { zones: out, overall };
}
