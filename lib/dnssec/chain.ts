import type { DsData, RrsigData } from 'dns-packet';

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
import {
  rrsigMetadataIssue,
  verifyDnskeyRrsig,
  verifyRrsetRrsig,
} from './rrsig';
import type {
  DnssecChain,
  DnssecDs,
  DnssecKey,
  DnssecSignatureEvidence,
  DnssecStatus,
  DnssecZone,
  DnssecZoneState,
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
 *
 * Keeps observed failure metadata as well as the expiration of the last valid
 * signature, so an expired outage remains distinguishable from a missing or
 * malformed signature.
 */
type SignatureAnalysis = {
  validUntil: number | null;
  evidence: DnssecSignatureEvidence;
};

const evidenceFrom = (
  status: DnssecSignatureEvidence['status'],
  rrsigs: RawZone['keyRrsigs'],
): DnssecSignatureEvidence => {
  const signatures = rrsigs ?? [];
  if (!signatures.length) return { status };
  const selected =
    status === 'not-yet-valid'
      ? signatures.reduce((earliest, signature) =>
          signature.inception < earliest.inception ? signature : earliest,
        )
      : signatures.reduce((latest, signature) =>
          signature.expiration > latest.expiration ? signature : latest,
        );
  return {
    status,
    inceptionAt: selected.inception,
    expiresAt: selected.expiration,
  };
};

const failedSignatureAnalysis = (
  rrsigs: RrsigData[],
  issueFor: (rrsig: RrsigData) => ReturnType<typeof rrsigMetadataIssue>,
): SignatureAnalysis => {
  if (!rrsigs.length) {
    return { validUntil: null, evidence: { status: 'missing' } };
  }
  const issues = rrsigs.map((rrsig) => ({
    rrsig,
    issue: issueFor(rrsig),
  }));
  // A failing supported-algorithm signature (crypto-invalid, expired, or not
  // yet valid) outranks a clean unsupported one: a co-published algorithm this
  // checker cannot run must not downgrade a bad signature to insecure
  // (RFC 6840 §5.11).
  const hasFailingSupported = issues.some(
    ({ rrsig, issue }) =>
      SUPPORTED_SIGNING_ALGORITHMS.has(rrsig.algorithm) &&
      (issue === null || issue === 'expired' || issue === 'not-yet-valid'),
  );
  const unsupported = issues
    .filter(
      ({ rrsig, issue }) =>
        issue === null && !SUPPORTED_SIGNING_ALGORITHMS.has(rrsig.algorithm),
    )
    .map(({ rrsig }) => rrsig);
  if (unsupported.length && !hasFailingSupported) {
    return {
      validUntil: null,
      evidence: evidenceFrom('unsupported', unsupported),
    };
  }
  const expired = issues
    .filter(({ issue }) => issue === 'expired')
    .map(({ rrsig }) => rrsig);
  if (expired.length) {
    return {
      validUntil: null,
      evidence: evidenceFrom('expired', expired),
    };
  }
  const notYetValid = issues
    .filter(({ issue }) => issue === 'not-yet-valid')
    .map(({ rrsig }) => rrsig);
  if (notYetValid.length) {
    return {
      validUntil: null,
      evidence: evidenceFrom('not-yet-valid', notYetValid),
    };
  }
  return {
    validUntil: null,
    evidence: evidenceFrom('invalid', rrsigs),
  };
};

function dnskeyRrsetSignatureAnalysis(
  zone: RawZone,
  keys: DnssecKey[],
  now: number,
): SignatureAnalysis {
  // Restrict signer candidates to the DS-linked keys themselves (by identity,
  // not by 16-bit tag): a colliding unanchored key must not be able to vouch
  // for the key set. `keys` is index-aligned with zone.keys.
  const linkedKeys = zone.keys.filter((_, i) => keys[i].linked);
  const rrsigs = (zone.keyRrsigs ?? []).filter(
    (rrsig) => rrsig.typeCovered === 'DNSKEY',
  );
  const valid = rrsigs
    .filter((rrsig) =>
      verifyDnskeyRrsig({
        rrsig,
        keys: zone.keys,
        ownerName: zone.name,
        now,
        signers: linkedKeys,
      }),
    )
    .map((rrsig) => rrsig.expiration);
  if (valid.length) {
    const validUntil = Math.max(...valid);
    return {
      validUntil,
      evidence: evidenceFrom(
        'valid',
        rrsigs.filter((rrsig) => rrsig.expiration === validUntil),
      ),
    };
  }

  return failedSignatureAnalysis(rrsigs, (rrsig) =>
    rrsigMetadataIssue({
      rrsig,
      type: 'DNSKEY',
      ownerName: zone.name,
      signerName: zone.name,
      keys: linkedKeys,
      now,
      allowWildcard: false,
    }),
  );
}

/** Authenticate a child's DS RRset with the already-authenticated parent keys. */
function dsRrsetSignatureAnalysis(
  zone: RawZone,
  parent: RawZone,
  now: number,
): SignatureAnalysis {
  const records = zone.dsRecords.map((data) => ({
    name: zone.name,
    type: 'DS',
    data,
  }));
  const rrsigs = (zone.dsRrsigs ?? []).filter(
    (rrsig) => rrsig.typeCovered === 'DS',
  );
  const valid = rrsigs
    .filter((rrsig) =>
      verifyRrsetRrsig({
        rrsig,
        type: 'DS',
        records,
        ownerName: zone.name,
        signerName: parent.name,
        keys: parent.keys,
        now,
        allowWildcard: false,
      }),
    )
    .map((rrsig) => rrsig.expiration);
  if (valid.length) {
    const validUntil = Math.max(...valid);
    return {
      validUntil,
      evidence: evidenceFrom(
        'valid',
        rrsigs.filter((rrsig) => rrsig.expiration === validUntil),
      ),
    };
  }
  return failedSignatureAnalysis(rrsigs, (rrsig) =>
    rrsigMetadataIssue({
      rrsig,
      type: 'DS',
      ownerName: zone.name,
      signerName: parent.name,
      keys: parent.keys,
      now,
      allowWildcard: false,
    }),
  );
}

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
 * `now` (Unix seconds) is the instant RRSIG validity is judged against; it
 * defaults to the current time and is injectable for deterministic tests.
 */
export function buildChain(
  zones: RawZone[],
  now: number = Math.floor(Date.now() / 1000),
  options: { initialTrustAnchors?: DsData[] } = {},
): DnssecChain {
  const out: DnssecZone[] = [];
  // Trust state carried down the chain: 'secure' while intact, otherwise the
  // reason it ended ('insecure' for an unsigned cut, 'broken' for a bogus zone).
  let chain: DnssecStatus = 'secure';

  for (const [zoneIndex, zone] of zones.entries()) {
    const isRoot = zone.name === '.' || zone.name === '';
    const anchors = isRoot
      ? ROOT_TRUST_ANCHORS
      : zoneIndex === 0
        ? (options.initialTrustAnchors ?? [])
        : zone.dsRecords;
    const parent = zoneIndex > 0 ? zones[zoneIndex - 1] : undefined;
    // A non-root first zone is secure only when its caller supplied an explicit
    // external trust anchor (useful for islands of security and unit tests). In
    // production walks the root is always first, so every child DS authenticates.
    const dsSignatureAnalysis =
      chain === 'secure' && !isRoot && parent && anchors.length > 0
        ? dsRrsetSignatureAnalysis(zone, parent, now)
        : undefined;
    const dsSignatureExpiresAt = dsSignatureAnalysis?.validUntil;
    const dsAuthenticationFailed =
      chain === 'secure' &&
      !isRoot &&
      parent !== undefined &&
      anchors.length > 0 &&
      dsSignatureExpiresAt === null;
    const dsSignatureAlgorithmUnsupported =
      dsAuthenticationFailed &&
      dsSignatureAnalysis?.evidence.status === 'unsupported';
    const authenticatedAnchors = dsAuthenticationFailed ? [] : anchors;

    const keys: DnssecKey[] = zone.keys.map((k) => {
      const rdata = dnskeyRdata(k);
      return {
        keyTag: computeKeyTag(rdata),
        algorithm: k.algorithm,
        algorithmName: algorithmName(k.algorithm),
        flags: k.flags,
        isSep: (k.flags & 0x0001) !== 0,
        isRevoked: (k.flags & 0x0080) !== 0,
        linked: authenticatedAnchors.some((ds) =>
          dsMatchesKey(ds, k, zone.name),
        ),
        bits: keyBits(k),
        deprecated: isDeprecatedAlgorithm(k.algorithm),
      };
    });

    const dsRecords: DnssecDs[] = anchors.map((ds) => {
      const matchedKeyIndexes = zone.keys.flatMap((key, index) =>
        dsMatchesKey(ds, key, zone.name) ? [index] : [],
      );
      return {
        keyTag: ds.keyTag,
        algorithm: ds.algorithm,
        algorithmName: algorithmName(ds.algorithm),
        digestType: ds.digestType,
        digestName: DIGEST_NAMES[ds.digestType] ?? `Digest ${ds.digestType}`,
        digestHex: ds.digest.toString('hex').toUpperCase(),
        matched: matchedKeyIndexes.length > 0,
        matchedKeyIndexes,
        weakDigest: isWeakDigest(ds.digestType),
      };
    });

    let state: DnssecZoneState;
    let dnskeySignatureExpiresAt: number | undefined;
    let dnskeySignature: DnssecSignatureEvidence | undefined;
    if (chain !== 'secure') {
      // The chain of trust already ended above this zone, so its own records are
      // unauthenticated. Propagate the reason: insecure below an unsigned cut,
      // broken below a bogus zone.
      state = { status: chain };
    } else if (dsSignatureAlgorithmUnsupported) {
      state = { status: 'insecure', breakReason: 'unsupported-algorithm' };
    } else if (dsAuthenticationFailed) {
      // A DS RRset is itself parent-zone data. Digest linkage is meaningful
      // only after its RRSIG verifies against the authenticated parent keys.
      state = { status: 'broken', breakReason: 'bad-ds-signature' };
    } else if (anchors.length === 0) {
      // No DS from the parent (nor a trust anchor): an unsigned / insecure
      // delegation. The chain is unsigned from here down regardless of whether
      // this zone serves its own keys.
      state = { status: 'insecure' };
    } else if (keys.length === 0) {
      // Parent vouches for this zone (DS present) but it serves no DNSKEY -> bogus.
      state = { status: 'broken', breakReason: 'no-dnskey' };
      dnskeySignature = { status: 'missing' };
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
        state = { status: 'broken', breakReason: 'ds-mismatch' };
      } else {
        state = { status: 'insecure', breakReason: 'unsupported-algorithm' };
      }
    } else {
      const signatureAnalysis = dnskeyRrsetSignatureAnalysis(zone, keys, now);
      dnskeySignature = signatureAnalysis.evidence;
      if (signatureAnalysis.validUntil === null) {
        // Keys link by digest, but the RRSIG over the DNSKEY RRset is missing,
        // expired, or fails to verify -> the key set isn't validly signed (bogus).
        // Exception: if no DS-linked key even uses an algorithm this validator
        // implements (e.g. ECC-GOST), verification never ran -- the zone is
        // unvalidatable, not bogus. A linked key with a supported algorithm but
        // malformed key material stays bogus: that is a broken configuration,
        // not an unsupported one.
        const eligibleLinkedKeys = zone.keys.filter(
          (key, index) =>
            keys[index].linked &&
            (key.flags & 0x0100) !== 0 &&
            (key.flags & 0x0080) === 0,
        );
        const hasSupportedLinkedKey = eligibleLinkedKeys.some((key) =>
          SUPPORTED_SIGNING_ALGORITHMS.has(key.algorithm),
        );
        const hasUnsupportedLinkedKey = eligibleLinkedKeys.some(
          (key) => !SUPPORTED_SIGNING_ALGORITHMS.has(key.algorithm),
        );
        if (
          signatureAnalysis.evidence.status !== 'unsupported' &&
          (hasSupportedLinkedKey || !hasUnsupportedLinkedKey)
        ) {
          state = { status: 'broken', breakReason: 'bad-signature' };
        } else {
          state = { status: 'insecure', breakReason: 'unsupported-algorithm' };
        }
      } else {
        state = { status: 'secure' };
        dnskeySignatureExpiresAt = signatureAnalysis.validUntil;
      }
    }

    const expiries = [dsSignatureExpiresAt, dnskeySignatureExpiresAt].filter(
      (expiry): expiry is number => typeof expiry === 'number',
    );

    out.push({
      name: zone.name,
      keys,
      dsRecords,
      ...state,
      dsSignature: dsSignatureAnalysis?.evidence,
      dnskeySignature,
      signatureExpiresAt: expiries.length ? Math.min(...expiries) : undefined,
    });
    // The first non-secure zone fixes the descended trust state.
    if (chain === 'secure') chain = state.status;
  }

  const status: DnssecStatus = out.some((z) => z.status === 'broken')
    ? 'broken'
    : out.every((z) => z.status === 'secure')
      ? 'secure'
      : 'insecure';

  return {
    zones: out,
    status,
    coverage: {
      delegationDsRrsets: 'validated-along-secure-path',
      dnskeyRrsets: 'validated',
      positiveRrsets: 'common-types-only',
      checkedPositiveRrsetTypes: [],
      negativeProofs: 'not-implemented',
      unsignedSubdelegations: 'not-implemented',
      cnameTargets: 'not-checked',
    },
    query: {
      name: zones.at(-1)?.name ?? '',
      observation: 'not-checked',
    },
  };
}
