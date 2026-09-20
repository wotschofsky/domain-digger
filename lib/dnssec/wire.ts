import type { DnskeyData } from 'dns-packet';

// Wire-format pieces the DS digest needs (RFC 4034 §5.1.4 / Appendix B).
// RRSIG canonicalization stays with the signature checker.

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

/** Key tag of a DNSKEY, including the RSAMD5 exception (RFC 4034 Appendix B.1). */
export const dnskeyKeyTag = (
  key: Pick<DnskeyData, 'flags' | 'algorithm' | 'key'>,
): number => {
  const rdata = dnskeyRdata(key);
  if (key.algorithm === 1) return (rdata.at(-3)! << 8) | rdata.at(-2)!;
  return computeKeyTag(rdata);
};
