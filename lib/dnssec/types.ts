import type { DnskeyData, DsData, RrsigData } from 'dns-packet';

export type DnssecStatus = 'secure' | 'insecure' | 'broken';

export const RRSET_STATUS_BY_REASON = {
  validated: 'secure',
  'no-records': 'absent',
  'missing-rrsig': 'unsigned',
  'unsupported-type': 'unsupported',
  'unsupported-rdata': 'unsupported',
  'unsupported-algorithm': 'unsupported',
  'unauthenticated-signer': 'bogus',
  expired: 'bogus',
  'not-yet-valid': 'bogus',
  'invalid-signature': 'bogus',
  'lookup-failed': 'indeterminate',
  // RFC 4035 §5.3.4: a wildcard-expanded positive answer is only proven by an
  // additional NSEC/NSEC3 denial that no closer name exists. Those proofs are
  // not validated here, so a valid wildcard signature alone stays inconclusive
  // -- a signed wildcard RRset could otherwise be replayed over a real name.
  // Deliberately `indeterminate` rather than the RFC's bogus-for-validators:
  // this checker never fetched the NSEC records, so it cannot distinguish "no
  // proof exists" (bogus) from "proof exists but was not checked" -- calling
  // every legitimate wildcard deployment bogus would be a false alarm.
  'wildcard-no-denial-proof': 'indeterminate',
  // A CNAME synthesized from a DNAME (RFC 6672 §3.2) legitimately has no
  // RRSIG of its own; the proof lives on the covering DNAME, which this
  // checker does not validate yet.
  'dname-synthesized': 'unsupported',
} as const;

export type DnssecRrsetReason = keyof typeof RRSET_STATUS_BY_REASON;
export type DnssecRrsetStatus =
  (typeof RRSET_STATUS_BY_REASON)[DnssecRrsetReason];

export type DnssecRrsetFields = {
  type: string;
  recordCount: number;
  // CNAME only: the alias target. The target's own chain is not validated
  // here, so the UI must surface the alias instead of implying full coverage.
  cnameTarget?: string;
  signerName?: string;
  signerKeyTag?: number;
  signerAlgorithmName?: string;
  signatureInceptionAt?: number;
  signatureExpiresAt?: number;
  signatureOriginalTtl?: number;
};

type DnssecRrsetState = {
  [Reason in DnssecRrsetReason]: {
    readonly reason: Reason;
    readonly status: (typeof RRSET_STATUS_BY_REASON)[Reason];
  };
}[DnssecRrsetReason];

// A reason has exactly one status, so values such as `secure + expired` are
// unrepresentable even for consumers constructing this exported type.
export type DnssecRrset = DnssecRrsetFields & DnssecRrsetState;

export type DnssecAnswerRecord = {
  name: string;
  type: string;
  data: unknown;
};

export type DnssecKey = {
  keyTag: number;
  algorithm: number;
  algorithmName: string;
  flags: number;
  flagNames: string; // the set flags, named: e.g. 'ZONE + SEP'
  isSep: boolean; // Secure Entry Point (KSK) -- signs the DNSKEY RRset
  isRevoked: boolean;
  // A DS that a validator would actually use hashes to this key, so it
  // authenticates the zone. Implies `dsMatched`.
  linked: boolean;
  // Some published DS hashes to this key, including one the downgrade rules
  // rule out (SHA-1 beside a SHA-256, or an unsupported algorithm). Kept
  // separate so the UI can pair every DS with its key without implying trust.
  dsMatched: boolean;
  bits: number | null; // key strength in bits (RSA modulus / curve size)
  deprecated: boolean; // uses a deprecated/weak signing algorithm
};

export type DnssecDs = {
  keyTag: number;
  algorithm: number;
  algorithmName: string;
  digestType: number;
  digestName: string;
  digestHex: string; // the DS digest, uppercase hex (a key fingerprint)
  // The zone DNSKEY this DS hashes to, by identity -- key tags alone collide.
  // Absent when no served key matches.
  matchedKey?: DnssecKey;
  // A shipped trust anchor that is simply not in the served key set right now
  // (the standby root KSK outside a rollover), rather than a broken link.
  standby: boolean;
  weakDigest: boolean; // uses a deprecated digest (SHA-1 / GOST)
};

export type DnssecBreakReason =
  | 'no-dnskey'
  | 'ds-mismatch'
  | 'bad-ds-signature'
  | 'bad-signature'
  | 'unsupported-algorithm';

export type DnssecSignatureStatus =
  | 'valid'
  | 'missing'
  | 'expired'
  | 'not-yet-valid'
  | 'invalid'
  | 'unsupported';

export type DnssecSignatureEvidence = {
  status: DnssecSignatureStatus;
  // These are observed fields, even when the signature is invalid. The UI
  // must only call the timestamp "valid until" when status is `valid`.
  inceptionAt?: number;
  expiresAt?: number;
};

export type DnssecQueryObservation =
  | 'not-checked'
  | 'positive'
  | 'unproved-nxdomain'
  | 'unproved-nodata'
  | 'indeterminate';

type DnssecZoneEvidence = {
  name: string; // '.', 'dev', 'wsky.dev'
  keys: DnssecKey[];
  dsRecords: DnssecDs[]; // DS published by the parent (or the root trust anchor)
  // Parent-signed DS evidence is absent for the root trust anchor. Evidence is
  // retained on failures so an expired signature remains diagnosable.
  dsSignature?: DnssecSignatureEvidence;
  dnskeySignature?: DnssecSignatureEvidence;
  // Positive leaf RRsets that were probed and validated. Absent RRsets are kept
  // in the model so the UI can distinguish "not present" from "not checked".
  rrsets?: DnssecRrset[];
};

// The discriminated shape prevents impossible combinations such as a secure
// zone carrying a break reason. A missing reason on a non-secure zone means the
// state was inherited from an earlier break in the chain.
export type DnssecZoneState =
  | { status: 'secure'; breakReason?: never }
  | {
      status: 'insecure';
      breakReason?: Extract<DnssecBreakReason, 'unsupported-algorithm'>;
    }
  | {
      status: 'broken';
      breakReason?: Exclude<DnssecBreakReason, 'unsupported-algorithm'>;
    };

export type DnssecZone = DnssecZoneEvidence &
  DnssecZoneState & {
    // This zone's status was propagated from a break above it rather than
    // decided on its own records. Recorded by the walk, which takes that
    // branch explicitly, so nothing downstream has to rediscover it by
    // scanning for the first non-secure zone.
    inherited: boolean;
  };

/**
 * Which outcome the page leads with. This is precedence policy, not wording:
 * an unproved NXDOMAIN outranks a secure or unsigned chain but not a bogus one
 * (a name that "does not exist" under a broken link is itself untrustworthy),
 * an unproved NODATA outranks RRset problems, problems outrank unchecked
 * RRsets, and a named break reason outranks the generic no-DS message. The
 * copy for each outcome lives with the view.
 */
export type DnssecVerdict =
  /** No zones were built -- nothing can be said. */
  | { kind: 'unknown' }
  /** The servers answered NXDOMAIN, which is not cryptographically proven. */
  | { kind: 'nxdomain-unproved' }
  /** The chain authenticates, but no positive record set was observed. */
  | { kind: 'secure-nodata' }
  | { kind: 'secure-rrset-problems'; rrsetTypes: string[] }
  | { kind: 'secure-rrset-unchecked'; rrsetTypes: string[] }
  | { kind: 'secure-validated'; validatedRrsetCount: number }
  /** Every link holds; no leaf RRsets were validated to report. */
  | { kind: 'secure' }
  /** The chain ends at a zone that failed for a named reason. */
  | { kind: 'break'; reason: DnssecBreakReason }
  /** No DS was observed at the break zone -- an unsigned cut, not a proof. */
  | { kind: 'unsigned-cut'; atLeaf: boolean }
  /** A break with no reason recorded: no authenticated DS link was seen. */
  | { kind: 'no-authenticated-ds' };

// What a chain result covers: every delegation DS RRset is validated along the
// secure path, every zone's DNSKEY RRset is validated, and the leaf's positive
// RRsets are checked for the common types below. Negative proofs (NSEC/NSEC3),
// unsigned sub-delegations, and CNAME targets are out of scope -- see
// lib/dnssec/index.ts.
export type DnssecCoverage = {
  checkedPositiveRrsetTypes: string[];
};

/**
 * What the chain walk alone establishes, before the queried name's own records
 * are probed. `resolveDnssecChain` composes this into a `DnssecChain`.
 */
export type DnssecChainResult = {
  zones: DnssecZone[];
  // Chain-only status. Positive leaf RRset results are reported separately.
  status: DnssecStatus;
  // Index in `zones` of the first zone whose link to its parent does not hold,
  // i.e. where the chain of trust ends. Absent when every link holds.
  breakAt?: number;
};

export type DnssecChain = DnssecChainResult & {
  coverage: DnssecCoverage;
  query: {
    name: string;
    observation: DnssecQueryObservation;
  };
  // The queried name's CNAME target, when it is an alias. Its own chain is not
  // validated, so the UI must say so rather than imply coverage.
  leafAlias?: string;
  verdict: DnssecVerdict;
};

/** Raw per-zone records collected by the resolver, ordered root -> leaf. */
export type RawZone = {
  name: string;
  keys: DnskeyData[];
  dsRecords: DsData[];
  // RRSIG records covering this zone's DNSKEY RRset (typeCovered === 'DNSKEY').
  // Used to cryptographically verify the key set is validly signed by its KSK.
  keyRrsigs?: RrsigData[];
  // RRSIG records made by the authenticated parent over this zone's DS RRset.
  // Empty/absent when no DS was observed; proving that absence needs NSEC/NSEC3.
  dsRrsigs?: RrsigData[];
};
