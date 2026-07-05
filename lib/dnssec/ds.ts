import { createHash } from 'node:crypto';

import type { DnskeyData, DsData } from 'dns-packet';

import { DIGEST_HASH_ALGOS } from './algorithms';
import { computeKeyTag, dnskeyRdata, wireName } from './wire';

// DS digest linkage (RFC 4034 §5.1.4): does a parent's DS record actually
// hash to one of the child zone's DNSKEYs?

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
