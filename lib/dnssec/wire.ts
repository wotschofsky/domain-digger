import dnsPacket, { type DnskeyData, type RrsigData } from 'dns-packet';
import { toType } from 'dns-packet/types';

// Canonical wire-format encoding (RFC 4034 §6): domain names, RDATA, and the
// exact byte layout an RRSIG signature is computed over.

/** Canonical wire-format encoding of a domain name (lowercase, length-prefixed). */
export const wireName = (name: string): Buffer => {
  const clean = name.replace(/\.$/, '');
  if (clean === '') return Buffer.from([0]); // root
  const parts: Buffer[] = [];
  for (const label of clean.toLowerCase().split('.')) {
    const labelBuf = Buffer.from(label, 'ascii');
    parts.push(Buffer.from([labelBuf.length]), labelBuf);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
};

/** DNSKEY RDATA wire format: flags(2) | protocol(1, always 3) | algorithm(1) | publicKey. */
export const dnskeyRdata = (
  key: Pick<DnskeyData, 'flags' | 'algorithm' | 'key'>,
): Buffer => {
  const head = Buffer.alloc(4);
  head.writeUInt16BE(key.flags, 0);
  head.writeUInt8(3, 2);
  head.writeUInt8(key.algorithm, 3);
  return Buffer.concat([head, key.key]);
};

/** Key tag computation per RFC 4034 Appendix B (general case). */
export const computeKeyTag = (rdata: Buffer): number => {
  let ac = 0;
  for (let i = 0; i < rdata.length; i++) {
    ac += i & 1 ? rdata[i] : rdata[i] << 8;
  }
  ac += (ac >> 16) & 0xffff;
  return ac & 0xffff;
};

/** RRSIG RDATA up to (but excluding) the signature, per RFC 4034 §3.1.8.1. */
export const rrsigSigningPrefix = (rrsig: RrsigData): Buffer | null => {
  // dns-packet's toType returns 0 for names it doesn't know.
  const typeCovered = toType(rrsig.typeCovered);
  if (!typeCovered) return null;
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
};

/** One canonical RR: owner | type | class(IN) | originalTTL | rdlen | rdata. */
export const canonicalRr = (
  owner: string,
  type: number,
  originalTTL: number,
  rdata: Buffer,
): Buffer => {
  const head = Buffer.alloc(10);
  head.writeUInt16BE(type, 0);
  head.writeUInt16BE(1, 2); // class IN
  head.writeUInt32BE(originalTTL >>> 0, 4);
  head.writeUInt16BE(rdata.length, 8);
  return Buffer.concat([wireName(owner), head, rdata]);
};

export const normalizeDomain = (name: string): string =>
  name.replace(/\.$/, '').toLowerCase();

// Types whose entire RDATA is one domain name.
const NAME_ONLY_TYPES = new Set(['NS', 'CNAME', 'PTR', 'DNAME']);

// Name-bearing RDATA fields per type, which must be lowercased for the
// canonical form. Normalization is all-or-nothing: a record missing any of its
// type's fields is left untouched rather than half-canonicalized.
const NAME_FIELDS: Record<string, readonly string[]> = {
  MX: ['exchange'],
  SOA: ['mname', 'rname'],
  SRV: ['target'],
  NAPTR: ['replacement'],
  RP: ['mbox', 'txt'],
  NSEC: ['nextDomain'],
  RRSIG: ['signersName'],
};

const normalizeRdata = (type: string, data: unknown): unknown => {
  if (NAME_ONLY_TYPES.has(type)) {
    return typeof data === 'string' ? normalizeDomain(data) : data;
  }
  const fields = NAME_FIELDS[type];
  if (!fields || typeof data !== 'object' || data === null) return data;
  if (!fields.every((field) => field in data)) return data;
  const record = data as Record<string, unknown>;
  return {
    ...data,
    ...Object.fromEntries(
      fields.map((field) => [field, normalizeDomain(String(record[field]))]),
    ),
  };
};

// dns-packet exposes these legacy name-bearing RDATA formats as opaque bytes,
// so their embedded domain names cannot be lowercased safely. Reject them
// instead of silently generating a non-canonical signature input. Supporting
// them requires a structured wire codec for every embedded name.
const OPAQUE_NAME_RDATA_TYPES = new Set([
  'AFSDB',
  'KX',
  'MB',
  'MD',
  'MF',
  'MG',
  'MINFO',
  'MR',
  'PX',
]);

// @types/dns-packet omits the record() rdata codec.
const dnsPacketRecord = (
  dnsPacket as unknown as {
    record: (type: string) => { encode: (data: unknown) => Buffer };
  }
).record;

export const canonicalRdata = (type: string, data: unknown): Buffer | null => {
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

  if (OPAQUE_NAME_RDATA_TYPES.has(type)) return null;

  if (!toType(type)) return null;

  try {
    const encoded = dnsPacketRecord(type).encode(normalizeRdata(type, data));
    return encoded.subarray(2);
  } catch {
    return null;
  }
};

export const canonicalOwnerForRrsig = (
  ownerName: string,
  rrsig: RrsigData,
): string | null => {
  const clean = normalizeDomain(ownerName);
  const labels = clean ? clean.split('.') : [];
  // RFC 4035 section 5.3.1: an RRSIG claiming more labels than the owner has
  // is protocol-invalid and MUST NOT authenticate the RRset.
  if (rrsig.labels > labels.length) return null;
  if (rrsig.labels === labels.length) return clean || '.';

  const suffix = labels.slice(labels.length - rrsig.labels).join('.');
  return suffix ? `*.${suffix}` : '*';
};
