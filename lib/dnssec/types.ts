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
  isSep: boolean; // Secure Entry Point (KSK) -- signs the DNSKEY RRset
  isRevoked: boolean;
  linked: boolean; // a parent DS / trust anchor matches this key
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
  matched: boolean; // this DS hashes to one of the zone's DNSKEYs
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
  // Earliest relevant RRSIG expiry for the zone: parent DS, DNSKEY, and for the
  // leaf its validated positive RRsets.
  signatureExpiresAt?: number;
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

export type DnssecZone = DnssecZoneEvidence & DnssecZoneState;

export type DnssecCoverage = {
  delegationDsRrsets: 'validated-along-secure-path';
  dnskeyRrsets: 'validated';
  positiveRrsets: 'common-types-only';
  checkedPositiveRrsetTypes: string[];
  negativeProofs: 'not-implemented';
  unsignedSubdelegations: 'not-implemented';
  cnameTargets: 'not-checked';
};

export type DnssecChain = {
  zones: DnssecZone[];
  // Chain-only status. Positive leaf RRset results are reported separately.
  status: DnssecStatus;
  coverage: DnssecCoverage;
  query: {
    name: string;
    observation: DnssecQueryObservation;
  };
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
