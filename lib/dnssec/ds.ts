import { createHash } from 'node:crypto';

import type { DnskeyData, DsData } from 'dns-packet';

import { digestHash, isSupportedSigningAlgorithm } from './algorithms';
import { dnskeyKeyTag, dnskeyRdata, isZoneKey, wireName } from './wire';

// DS digest linkage (RFC 4034 §5.1.4): which of a child zone's DNSKEYs do the
// parent's DS records actually hash to, and which of those DS records count?

/** DS digest of a DNSKEY: hash(ownerName || DNSKEY RDATA). Null if digest type unsupported. */
export const dsDigest = (
  zoneName: string,
  key: Pick<DnskeyData, 'flags' | 'algorithm' | 'key'>,
  digestType: number,
): Buffer | null => {
  const algo = digestHash(digestType);
  if (!algo) return null;
  return createHash(algo)
    .update(Buffer.concat([wireName(zoneName), dnskeyRdata(key)]))
    .digest();
};

/**
 * Whether a DS record authenticates a given DNSKEY of a zone. Following the
 * validator selection rule (RFC 4035 §5.2), the DS must agree with the DNSKEY on
 * algorithm and key tag before the digest is verified -- a real resolver picks
 * candidate keys by tag/algorithm and never reaches the digest for a DS whose
 * tag is wrong, so a malformed DS (right digest, wrong tag) is correctly treated
 * as a non-match here too.
 */
const dsMatchesKey = (
  ds: DsData,
  key: DnskeyData,
  zoneName: string,
): boolean => {
  // RFC 4034 §5.2: a DS may only point at a Zone Key (bit 7).
  if (!isZoneKey(key)) return false;
  if (ds.algorithm !== key.algorithm) return false;
  if (ds.keyTag !== dnskeyKeyTag(key)) return false;
  const digest = dsDigest(zoneName, key, ds.digestType);
  return digest !== null && digest.equals(ds.digest);
};

export type DsLink = {
  // unsigned: no DS this validator can use, so the zone cannot be
  // authenticated (RFC 4035 §5.2). mismatch: the deciding DS records link no
  // key. linked: linkedKeys are the keys the deciding DS records vouch for.
  status: 'unsigned' | 'mismatch' | 'linked';
  linkedKeys: DnskeyData[];
  // Per DS record, in input order: whether it hashes to one of the keys,
  // deciding or not.
  matched: boolean[];
};

/**
 * Link a zone's DS set to its DNSKEYs. Only supported digests and signing
 * algorithms decide, and SHA-1 is ignored next to a stronger digest (RFC 4509
 * section 3), so a matching SHA-1 record cannot hide a broken stronger digest.
 */
export const linkKeys = (
  zoneName: string,
  dsRecords: DsData[],
  keys: DnskeyData[],
): DsLink => {
  const matchedKeys = dsRecords.map((ds) =>
    keys.filter((key) => dsMatchesKey(ds, key, zoneName)),
  );
  const supported = dsRecords.flatMap((ds, i) =>
    digestHash(ds.digestType) && isSupportedSigningAlgorithm(ds.algorithm)
      ? [{ ds, keys: matchedKeys[i] }]
      : [],
  );
  const hasStrong = supported.some(({ ds }) => ds.digestType !== 1);
  const linkedKeys = supported
    .filter(({ ds }) => !hasStrong || ds.digestType !== 1)
    .flatMap((deciding) => deciding.keys);
  return {
    status:
      supported.length === 0
        ? 'unsigned'
        : linkedKeys.length === 0
          ? 'mismatch'
          : 'linked',
    linkedKeys,
    matched: matchedKeys.map((matches) => matches.length > 0),
  };
};
