import type { DnskeyData, DsData, RrsigData } from 'dns-packet';

export type DnssecStatus = 'secure' | 'insecure' | 'broken';

export type DnssecRrsetStatus =
  | 'secure'
  | 'unsigned'
  | 'bogus'
  | 'unsupported'
  | 'absent'
  | 'indeterminate';

export type DnssecRrsetReason =
  | 'validated'
  | 'no-records'
  | 'missing-rrsig'
  | 'unsupported-type'
  | 'unsupported-rdata'
  | 'unauthenticated-signer'
  | 'expired'
  | 'not-yet-valid'
  | 'invalid-signature'
  | 'lookup-failed';

export type DnssecRrset = {
  type: string;
  status: DnssecRrsetStatus;
  reason: DnssecRrsetReason;
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

export type DnssecZone = {
  name: string; // '.', 'dev', 'wsky.dev'
  keys: DnssecKey[];
  dsRecords: DnssecDs[]; // DS published by the parent (or the root trust anchor)
  status: DnssecStatus;
  // Why the chain could not continue at this zone, for a precise verdict
  // message. Undefined for secure zones and plain unsigned delegations.
  //   'no-dnskey'     : parent published a DS but the zone serves no DNSKEY.
  //   'ds-mismatch'   : the DS authenticates none of the served keys (digest).
  //   'bad-signature' : keys link by digest, but the RRSIG over the DNSKEY RRset
  //                     is missing, expired, or fails to verify (bogus/expired).
  //   'unsupported-algorithm' : this validator supports none of the DS digest /
  //                     signing algorithms, so the zone is unvalidatable and
  //                     treated as insecure, not bogus (RFC 4035 §5.2).
  breakReason?:
    | 'no-dnskey'
    | 'ds-mismatch'
    | 'bad-signature'
    | 'unsupported-algorithm';
  // Earliest relevant RRSIG expiry (Unix seconds): for every secure zone, the
  // expiry of the RRSIG validating its DNSKEY RRset; for the leaf, additionally
  // min'd with its validated positive RRsets. Expiring/expired signatures are
  // the most common real DNSSEC outage, so the UI warns ahead of time.
  signatureExpiresAt?: number;
  // Positive leaf RRsets that were probed and validated. Absent RRsets are kept
  // in the model so the UI can distinguish "not present" from "not checked".
  rrsets?: DnssecRrset[];
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
  // RRSIG records covering this zone's DNSKEY RRset (typeCovered === 'DNSKEY').
  // Used to cryptographically verify the key set is validly signed by its KSK.
  keyRrsigs?: RrsigData[];
};
