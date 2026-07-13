// WHAT THIS VERIFIES: the DNSSEC authentication chain, three ways per zone.
// (1) Delegation signature: the parent's authenticated keys verify the RRSIG
//     over the child's DS RRset. (2) Digest linkage (RFC 4034 §5.1.4): that
//     authenticated DS hashes to one of the child zone's DNSKEYs, anchored at
//     the root by the IANA trust anchor. (3) Key-set signature (RFC 4034
//     §3.1.8.1): the RRSIG over
//     each zone's DNSKEY RRset cryptographically verifies against the DS-linked
//     KSK and is within its inception/expiration window. Together these prove
//     the zone's key set is authentic AND currently, validly signed -- so an
//     expired or forged key-set signature (the most common real DNSSEC outage)
//     is caught and marked broken, not shown as secure.
//
// WHAT IT STILL DOES NOT VERIFY (documented limitations, shown on the page):
//   - Per-RRset data signatures below the DNSKEY RRset. We confirm each zone's
//     *keys* are validly signed, then separately validate positive leaf RRsets
//     that exist for common record types. Negative answers are not validated.
//   - NSEC/NSEC3 denial-of-existence proofs (authenticated negative answers).
//     Bare NXDOMAIN/NODATA responses are retained only as explicitly unproved
//     observations so the UI cannot turn them into a secure/nonexistent claim.
//   - Unsigned *delegations* below the registered domain: a queried name that is
//     itself a separate, unsigned sub-delegation is shown via its nearest signed
//     ancestor zone rather than flagged insecure. Telling that apart from a name
//     simply covered by its parent zone needs NS zone-cut probing plus an NSEC
//     proof that no DS exists -- both beyond this check.
//
// NSEC/NSEC3 proof validation is left as a future improvement.
//
// Module layout:
//   types.ts      -- the chain/zone/key/DS/RRset data model
//   algorithms.ts -- algorithm registry and policy (deprecated, weak, supported)
//   wire.ts       -- canonical wire-format encoding (RFC 4034 §6)
//   crypto.ts     -- DNSKEY -> node crypto key, raw signature verification
//   ds.ts         -- DS digest linkage (parent DS -> child DNSKEY)
//   rrsig.ts      -- RRSIG verification over canonical RRsets
//   rrset.ts      -- positive leaf RRset validation and classification
//   chain.ts      -- root trust anchors and the top-down chain walk
//   resolve.ts    -- the zone walk over an injected, transport-agnostic query

export {
  isDeprecatedAlgorithm,
  isWeakDigest,
  isWeakKey,
  keyBits,
} from './algorithms';
export { buildChain, ROOT_TRUST_ANCHORS } from './chain';
export {
  type DnssecQuery,
  type DnssecQueryResult,
  resolveDnssecChain,
} from './resolve';
export type {
  DnssecChain,
  DnssecBreakReason,
  DnssecCoverage,
  DnssecDs,
  DnssecKey,
  DnssecQueryObservation,
  DnssecRrset,
  DnssecRrsetReason,
  DnssecRrsetStatus,
  DnssecSignatureEvidence,
  DnssecSignatureStatus,
  DnssecStatus,
  DnssecZone,
  DnssecZoneState,
  RawZone,
} from './types';
export { dnskeyToPublicKey } from './crypto';
export { dsDigest, dsMatchesKey } from './ds';
export { verifyDnskeyRrsig, verifyRrsetRrsig } from './rrsig';
export { signerId, validatePositiveRrset } from './rrset';
export { canonicalRdata, computeKeyTag, dnskeyRdata, wireName } from './wire';
