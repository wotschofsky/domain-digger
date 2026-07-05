import dnsPacket, { type DnskeyData, type RrsigData } from 'dns-packet';
import { toType } from 'dns-packet/types';

// Canonical wire-format encoding (RFC 4034 §6): domain names, RDATA, and the
// exact byte layout an RRSIG signature is computed over.

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
export function computeKeyTag(rdata: Buffer): number {
  let ac = 0;
  for (let i = 0; i < rdata.length; i++) {
    ac += i & 1 ? rdata[i] : rdata[i] << 8;
  }
  ac += (ac >> 16) & 0xffff;
  return ac & 0xffff;
}

/** RRSIG RDATA up to (but excluding) the signature, per RFC 4034 §3.1.8.1. */
export function rrsigSigningPrefix(rrsig: RrsigData): Buffer | null {
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
}

/** One canonical RR: owner | type | class(IN) | originalTTL | rdlen | rdata. */
export function canonicalRr(
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

export const normalizeDomain = (name: string): string =>
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

// @types/dns-packet omits the record() rdata codec.
const dnsPacketRecord = (
  dnsPacket as unknown as {
    record: (type: string) => { encode: (data: unknown) => Buffer };
  }
).record;

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

  if (!toType(type)) return null;

  try {
    const encoded = dnsPacketRecord(type).encode(normalizeRdata(type, data));
    return encoded.subarray(2);
  } catch {
    return null;
  }
}

export const canonicalOwnerForRrsig = (
  ownerName: string,
  rrsig: RrsigData,
): string => {
  const clean = ownerName.replace(/\.$/, '').toLowerCase();
  const labels = clean ? clean.split('.') : [];
  if (rrsig.labels >= labels.length) return clean || '.';

  const suffix = labels.slice(labels.length - rrsig.labels).join('.');
  return suffix ? `*.${suffix}` : '*';
};
