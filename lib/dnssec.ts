import { createHash } from 'node:crypto';

import type { DnskeyData, DsData } from 'dns-packet';

// LIMITATION: This module verifies the DNSSEC *authentication chain* by digest
// linkage only -- it confirms that a parent's DS record actually hashes to one
// of the child zone's DNSKEYs (RFC 4034 §5.1.4), and anchors the root against
// the IANA trust anchor. It does NOT verify RRSIG signatures (the asymmetric
// crypto that proves a key signed an RRset) nor NSEC/NSEC3 denial-of-existence
// proofs. A zone marked "secure" here has an unbroken DS->DNSKEY chain to the
// root, which is the backbone of DNSSEC validation but not the whole of it.
//
// It also does not classify unsigned *delegations* below the registered domain:
// a queried name that is itself a separate, unsigned sub-delegation is shown via
// its nearest signed ancestor zone rather than flagged insecure. Telling that
// apart from a name simply covered by its parent zone needs NS zone-cut probing
// plus an NSEC proof that no DS exists -- both beyond this digest-chain check.
//
// Full RRSIG/NSEC validation is left as a future improvement.

export type DnssecStatus = 'secure' | 'insecure' | 'broken';

export type DnssecKey = {
  keyTag: number;
  algorithm: number;
  algorithmName: string;
  flags: number;
  isSep: boolean; // Secure Entry Point (KSK) -- signs the DNSKEY RRset
  isRevoked: boolean;
  linked: boolean; // a parent DS / trust anchor matches this key
};

export type DnssecDs = {
  keyTag: number;
  algorithm: number;
  algorithmName: string;
  digestType: number;
  digestName: string;
  matched: boolean; // this DS hashes to one of the zone's DNSKEYs
};

export type DnssecZone = {
  name: string; // '.', 'dev', 'wsky.dev'
  displayName: string; // 'root' for '.'
  keys: DnssecKey[];
  dsRecords: DnssecDs[]; // DS published by the parent (or the root trust anchor)
  status: DnssecStatus;
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
};

// IANA root zone trust anchor (KSK-2017, the currently published root KSK).
// https://www.iana.org/dnssec/files
export const ROOT_TRUST_ANCHORS: DsData[] = [
  {
    keyTag: 20326,
    algorithm: 8, // RSASHA256
    digestType: 2, // SHA-256
    digest: Buffer.from(
      'E06D44B80B8F1D39A95C0B0D7C65D08458E880409BBC683457104237C7F8EC8D',
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
 * Whether a DS record authenticates a given DNSKEY of a zone. The digest is
 * computed over the exact DNSKEY RDATA, so a digest match is the cryptographic
 * proof of identity. We deliberately do NOT require ds.keyTag to equal the
 * key's tag: per RFC 4034 §5.2 the key tag is a non-unique selection hint, and
 * validators use it only to pick candidate keys -- since we hash every key, a
 * digest match is authoritative even if a publisher set an inconsistent tag.
 */
export function dsMatchesKey(
  ds: DsData,
  key: DnskeyData,
  zoneName: string,
): boolean {
  if (ds.algorithm !== key.algorithm) return false;
  const digest = dsDigest(zoneName, key, ds.digestType);
  return digest !== null && digest.equals(ds.digest);
}

/**
 * Walk the collected zones top-down and compute a per-zone and overall status.
 * `secure`   : DS (or root anchor) links a key AND every zone above is secure.
 * `insecure` : no DS from the parent -- unsigned / insecure delegation.
 * `broken`   : parent published a DS but the zone serves no matching key (bogus),
 *              including the case where it serves no DNSKEY at all.
 *
 * Once the chain of trust ends, its reason propagates down: everything below an
 * unsigned delegation is `insecure` (unauthenticated, not bogus), and everything
 * below a bogus zone stays `broken`. A zone's own DS/DNSKEY state is only
 * consulted while the chain above it is still secure.
 */
export function buildChain(zones: RawZone[]): DnssecChain {
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
        algorithmName:
          ALGORITHM_NAMES[k.algorithm] ?? `Algorithm ${k.algorithm}`,
        flags: k.flags,
        isSep: (k.flags & 0x0001) !== 0,
        isRevoked: (k.flags & 0x0080) !== 0,
        linked: anchors.some((ds) => dsMatchesKey(ds, k, zone.name)),
      };
    });

    const dsRecords: DnssecDs[] = anchors.map((ds) => ({
      keyTag: ds.keyTag,
      algorithm: ds.algorithm,
      algorithmName:
        ALGORITHM_NAMES[ds.algorithm] ?? `Algorithm ${ds.algorithm}`,
      digestType: ds.digestType,
      digestName: DIGEST_NAMES[ds.digestType] ?? `Digest ${ds.digestType}`,
      matched: zone.keys.some((k) => dsMatchesKey(ds, k, zone.name)),
    }));

    let status: DnssecStatus;
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
    } else if (!dsRecords.some((d) => d.matched)) {
      // DS present but authenticates none of the served keys -> bogus.
      status = 'broken';
    } else {
      status = 'secure';
    }

    out.push({
      name: zone.name,
      displayName: isRoot ? 'root' : zone.name,
      keys,
      dsRecords,
      status,
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
