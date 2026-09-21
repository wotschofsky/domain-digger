import type { DnskeyData, DsData, RrsigData } from 'dns-packet';

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
import { checkRrsetSignatures, type RrsetSignatureOutcome } from './rrsig';
import type {
  DnssecChainResult,
  DnssecDs,
  DnssecKey,
  DnssecSignatureEvidence,
  DnssecSignatureStatus,
  DnssecStatus,
  DnssecZone,
  DnssecZoneState,
  RawZone,
} from './types';
import { describeKeyFlags, dnskeyKeyTag, isRevokedKey, isSepKey } from './wire';

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

const SIGNATURE_STATUS: Record<RrsetSignatureOutcome, DnssecSignatureStatus> = {
  valid: 'valid',
  missing: 'missing',
  'unsupported-algorithm': 'unsupported',
  expired: 'expired',
  'not-yet-valid': 'not-yet-valid',
  invalid: 'invalid',
  // Signed, but by no key the chain has authenticated.
  'unauthenticated-signer': 'invalid',
  // DS and DNSKEY RRsets are checked with wildcards disallowed, so the
  // label count already fails such a signature as invalid.
  'wildcard-expansion': 'invalid',
};

/**
 * What the RRSIGs over one of a zone's own link RRsets (its DS at the parent,
 * its DNSKEYs at the apex) establish. Failure evidence is kept so an expired
 * outage stays distinguishable from a missing or malformed signature.
 */
const linkSignature = (params: {
  type: 'DS' | 'DNSKEY';
  zone: RawZone;
  data: unknown[];
  rrsigs: RrsigData[] | undefined;
  signerName: string;
  // Keys trusted to vouch for the RRset.
  keys: DnskeyData[];
  now: number;
}): DnssecSignatureEvidence => {
  const { type, zone, data, rrsigs, signerName, keys, now } = params;
  const { outcome, rrsig } = checkRrsetSignatures({
    type,
    records: data.map((rdata) => ({ name: zone.name, type, data: rdata })),
    rrsigs: rrsigs ?? [],
    ownerName: zone.name,
    signerName,
    keys,
    now,
    allowWildcard: false,
  });
  return {
    status: SIGNATURE_STATUS[outcome],
    ...(rrsig && { inceptionAt: rrsig.inception, expiresAt: rrsig.expiration }),
  };
};

/**
 * Walk the collected zones top-down and compute a per-zone and overall status.
 * `secure`   : the parent authenticates the DS, it links a key, and every zone
 *              above is secure.
 * `insecure` : no DS was observed, or the algorithms are unsupported. Without
 *              NSEC/NSEC3 this does not prove that a DS is absent.
 * `broken`   : parent published a DS but the zone serves no matching key (bogus),
 *              including the case where it serves no DNSKEY at all.
 *
 * A zone is only `secure` when the parent authenticates the DS RRset, its digest
 * links to a child key, and the RRSIG over the child DNSKEY RRset verifies and is
 * currently valid. A linked-but-unsigned/expired key set is `broken`.
 *
 * Once the chain of trust ends, its reason propagates down: everything below an
 * unauthenticated link is `insecure` (not bogus), and everything below a bogus
 * zone stays `broken`. A zone's own DS/DNSKEY state is only consulted while the
 * chain above it is still secure.
 *
 * `now` (Unix seconds) is the instant RRSIG validity is judged against. The
 * caller owns the clock, so a whole check is judged against one instant.
 *
 * Returns only what the chain itself establishes. The queried name's own
 * records and the overall verdict are the caller's to add (see resolve.ts), so
 * nothing here invents a value it cannot know.
 */
export const buildChain = (
  zones: RawZone[],
  now: number,
  options: { initialTrustAnchors?: DsData[] } = {},
): DnssecChainResult => {
  const out: DnssecZone[] = [];
  // Trust state carried down the chain: 'secure' while intact, otherwise the
  // reason it ended ('insecure' for an unsigned cut, 'broken' for a bogus zone).
  let chain: DnssecStatus = 'secure';
  let breakAt: number | undefined;

  for (const [zoneIndex, zone] of zones.entries()) {
    const isRoot = zone.name === '.' || zone.name === '';
    // A non-root first zone is secure only when its caller supplied an explicit
    // external trust anchor (useful for islands of security and unit tests). In
    // production walks the root is always first, so every child DS authenticates.
    const anchors = isRoot
      ? ROOT_TRUST_ANCHORS
      : zoneIndex === 0
        ? (options.initialTrustAnchors ?? [])
        : zone.dsRecords;
    const parent = zoneIndex > 0 ? zones[zoneIndex - 1] : undefined;
    // A DS RRset is parent-zone data: the authenticated parent's keys must
    // have signed it before its digests mean anything.
    const dsSignature =
      chain === 'secure' && !isRoot && parent && anchors.length > 0
        ? linkSignature({
            type: 'DS',
            zone,
            data: zone.dsRecords,
            rrsigs: zone.dsRrsigs,
            signerName: parent.name,
            keys: parent.keys,
            now,
          })
        : undefined;
    const dsAuthenticationFailed =
      dsSignature !== undefined && dsSignature.status !== 'valid';
    const authenticatedAnchors = dsAuthenticationFailed ? [] : anchors;

    // Anchors a validator would actually trust: supported digest and signing
    // algorithm, and -- RFC 4509 §3 downgrade resistance -- SHA-1 DS records
    // are ignored when a SHA-256-or-stronger DS is present, so a weak digest
    // can't link a key the stronger digest fails to authenticate. The RFC
    // mandates only the SHA-1 rule; among SHA-256/SHA-384 either path is
    // accepted (implementations diverge here, and rejecting a valid SHA-256
    // link over a stale SHA-384 sibling would false-break healthy zones).
    const supportedAnchors = authenticatedAnchors.filter(
      (ds) =>
        ds.digestType in DIGEST_HASH_ALGOS &&
        SUPPORTED_SIGNING_ALGORITHMS.has(ds.algorithm),
    );
    const hasSha256OrStronger = supportedAnchors.some(
      (ds) => ds.digestType >= 2,
    );
    const usableAnchors = supportedAnchors.filter(
      (ds) => !(ds.digestType === 1 && hasSha256OrStronger),
    );

    // Pair each published DS with the served keys it hashes to, once. Both the
    // key metadata and the DS rows below are derived from this, so the pairing
    // is decided here rather than rediscovered by every consumer.
    const matchesPerAnchor = anchors.map((ds) =>
      zone.keys.flatMap((key, index) =>
        dsMatchesKey(ds, key, zone.name) ? [index] : [],
      ),
    );
    const dsMatchedIndexes = new Set(matchesPerAnchor.flat());
    const linkedIndexes = new Set(
      anchors.flatMap((ds, anchorIndex) =>
        usableAnchors.includes(ds) ? matchesPerAnchor[anchorIndex] : [],
      ),
    );

    const keys: DnssecKey[] = zone.keys.map((k, index) => ({
      keyTag: dnskeyKeyTag(k),
      algorithm: k.algorithm,
      algorithmName: algorithmName(k.algorithm),
      flags: k.flags,
      flagNames: describeKeyFlags(k),
      isSep: isSepKey(k),
      isRevoked: isRevokedKey(k),
      linked: linkedIndexes.has(index),
      dsMatched: dsMatchedIndexes.has(index),
      bits: keyBits(k),
      deprecated: isDeprecatedAlgorithm(k.algorithm),
    }));

    // The root always carries both IANA anchors; outside a KSK rollover only
    // one is served, and the other must not read as a broken link.
    const anyAnchorMatched = matchesPerAnchor.some((match) => match.length > 0);

    const dsRecords: DnssecDs[] = anchors.map((ds, anchorIndex) => {
      const matchIndex = matchesPerAnchor[anchorIndex][0];
      const matchedKey =
        matchIndex === undefined ? undefined : keys[matchIndex];
      return {
        keyTag: ds.keyTag,
        algorithm: ds.algorithm,
        algorithmName: algorithmName(ds.algorithm),
        digestType: ds.digestType,
        digestName: DIGEST_NAMES[ds.digestType] ?? `Digest ${ds.digestType}`,
        digestHex: ds.digest.toString('hex').toUpperCase(),
        matchedKey,
        standby: isRoot && matchedKey === undefined && anyAnchorMatched,
        weakDigest: isWeakDigest(ds.digestType),
      };
    });

    let state: DnssecZoneState;
    let dnskeySignature: DnssecSignatureEvidence | undefined;
    if (chain !== 'secure') {
      // The chain of trust already ended above this zone, so its own records are
      // unauthenticated. Propagate the reason: insecure below an unsigned cut,
      // broken below a bogus zone.
      state = { status: chain, inherited: true };
    } else if (dsSignature?.status === 'unsupported') {
      state = {
        status: 'insecure',
        inherited: false,
        breakReason: 'unsupported-algorithm',
      };
    } else if (dsAuthenticationFailed) {
      state = {
        status: 'broken',
        inherited: false,
        breakReason: 'bad-ds-signature',
      };
    } else if (anchors.length === 0) {
      // No DS from the parent (nor a trust anchor): an unsigned / insecure
      // delegation. The chain is unsigned from here down regardless of whether
      // this zone serves its own keys.
      state = { status: 'insecure', inherited: false };
    } else if (keys.length === 0) {
      // Parent vouches for this zone (DS present) but it serves no DNSKEY -> bogus.
      state = { status: 'broken', inherited: false, breakReason: 'no-dnskey' };
      dnskeySignature = { status: 'missing' };
    } else if (linkedIndexes.size === 0) {
      // `linked` already applies the usable-anchor rules above: matches via
      // unsupported algorithms or non-preferred digests don't count
      // (RFC 6840 §5.11 / RFC 4509 §3 downgrade resistance).
      // (if/else rather than a conditional expression, which sends TypeScript's
      // inference of `chain` through `state` and back in a circle.)
      if (usableAnchors.length > 0) {
        // A usable DS authenticates none of the served keys -> bogus.
        state = {
          status: 'broken',
          inherited: false,
          breakReason: 'ds-mismatch',
        };
      } else {
        // Every DS uses a digest or signing algorithm this validator doesn't
        // support: unvalidatable -> insecure, not bogus (RFC 4035 §5.2).
        state = {
          status: 'insecure',
          inherited: false,
          breakReason: 'unsupported-algorithm',
        };
      }
    } else {
      // Only DS-linked keys may vouch for the key set (by identity, not by
      // 16-bit tag): a zone must not authenticate its own DNSKEY RRset with a
      // key nothing above it has authenticated. A linked key always uses an
      // algorithm this validator runs -- usable anchors require one -- so a
      // failure here is never "unvalidatable": missing, expired or forged, the
      // key set isn't validly signed (bogus).
      dnskeySignature = linkSignature({
        type: 'DNSKEY',
        zone,
        data: zone.keys,
        rrsigs: zone.keyRrsigs,
        signerName: zone.name,
        keys: zone.keys.filter((_, index) => linkedIndexes.has(index)),
        now,
      });
      state =
        dnskeySignature.status === 'valid'
          ? { status: 'secure', inherited: false }
          : {
              status: 'broken',
              inherited: false,
              breakReason: 'bad-signature',
            };
    }

    out.push({
      name: zone.name,
      keys,
      dsRecords,
      ...state,
      dsSignature,
      dnskeySignature,
    });
    // The first non-secure zone fixes the descended trust state, and is where
    // the chain of trust ends.
    if (chain === 'secure' && state.status !== 'secure') {
      breakAt = zoneIndex;
      chain = state.status;
    }
  }

  // Everything below the break inherits its status, so the trust state the
  // walk ended in is the chain's.
  return { zones: out, status: chain, breakAt };
};
