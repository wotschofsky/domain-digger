import type { DsData } from 'dns-packet';

import {
  algorithmName,
  DIGEST_HASH_ALGOS,
  DIGEST_NAMES,
  isDeprecatedAlgorithm,
  isWeakDigest,
  keyBits,
  SUPPORTED_SIGNING_ALGORITHMS,
} from './algorithms';
import { dsMatchesKey } from './ds';
import { verifyDnskeyRrsig } from './rrsig';
import type {
  DnssecChain,
  DnssecDs,
  DnssecKey,
  DnssecStatus,
  DnssecZone,
  RawZone,
} from './types';
import { computeKeyTag, dnskeyRdata } from './wire';

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
