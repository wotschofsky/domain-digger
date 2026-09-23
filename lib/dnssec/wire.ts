import type { DnskeyData, RrsigData } from 'dns-packet';
import { toType } from 'dns-packet/types';

// Canonical wire-format encoding (RFC 4034 §6): domain names, DNSKEY RDATA, and
// the exact byte layout an RRSIG signature is computed over.

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

// DNSKEY flags (RFC 4034 §2.1.1, RFC 5011 §7). Decoded here so the bit
// positions live in exactly one place: every caller asks a named question
// instead of re-spelling a mask.
const DNSKEY_ZONE = 0x0100;
const DNSKEY_REVOKE = 0x0080;
const DNSKEY_SEP = 0x0001;

type KeyFlags = Pick<DnskeyData, 'flags'>;

/** Bit 7: the key may sign records in this zone (RFC 4034 §2.1.1). */
export const isZoneKey = (key: KeyFlags): boolean =>
  (key.flags & DNSKEY_ZONE) !== 0;

/** Bit 8: the key revokes itself, so validators must not trust it (RFC 5011 §2.1). */
export const isRevokedKey = (key: KeyFlags): boolean =>
  (key.flags & DNSKEY_REVOKE) !== 0;

/** Bit 15: Secure Entry Point, conventionally the KSK a DS points at. */
export const isSepKey = (key: KeyFlags): boolean =>
  (key.flags & DNSKEY_SEP) !== 0;

/** A key eligible to make a signature: a zone key that has not revoked itself. */
export const isEligibleSigner = (key: KeyFlags): boolean =>
  isZoneKey(key) && !isRevokedKey(key);

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

/** Key tag computation per RFC 4034 Appendix B (general case). */
export const computeKeyTag = (rdata: Buffer): number => {
  let ac = 0;
  for (let i = 0; i < rdata.length; i++) {
    ac += i & 1 ? rdata[i] : rdata[i] << 8;
  }
  ac += (ac >> 16) & 0xffff;
  return ac & 0xffff;
};

/** Key tag of a DNSKEY, including the RSAMD5 exception (RFC 4034 Appendix B.1). */
export const dnskeyKeyTag = (
  key: Pick<DnskeyData, 'flags' | 'algorithm' | 'key'>,
): number => {
  const rdata = dnskeyRdata(key);
  if (key.algorithm === 1) return (rdata.at(-3)! << 8) | rdata.at(-2)!;
  return computeKeyTag(rdata);
};
