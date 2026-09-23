import type { Answer, DnskeyData, DsData, RrsigData } from 'dns-packet';

import { canonicalDnsName, type RecordType } from '@/lib/resolvers/base';
import { UserFacingError } from '@/lib/user-facing-error';

import { algorithmName, isWeakDigest } from './algorithms';
import { linkKeys } from './ds';
import { checkRrsetSignatures, type RrsetSignatureOutcome } from './rrsig';
import { dnskeyKeyTag, dnskeyRdata, isSepKey } from './wire';

export type DsChainVerdict =
  | 'intact'
  | 'unsigned'
  | 'mismatch'
  // A DS links a key, but that key has not validly signed the zone's DNSKEY
  // RRset: missing, expired, not yet valid, or forged.
  | 'bad-signature';

export type DsChainZone = {
  name: string;
  keys: Array<{
    keyTag: number;
    algorithm: number;
    algorithmName: string;
    isSep: boolean;
  }>;
  dsRecords: Array<{
    keyTag: number;
    digestType: number;
    digestHex: string;
    matched: boolean;
    weakDigest: boolean;
  }>;
  // What the RRSIGs over the zone's DNSKEY RRset establish, checked against
  // the DS-linked keys. Only set while the chain above is intact and a DS
  // links a key: anywhere else there is no trusted key to check against.
  keySignature?: {
    outcome: RrsetSignatureOutcome;
    // Unix seconds, from the signature that explains the outcome.
    inception?: number;
    expiration?: number;
  };
  status: DsChainVerdict;
};

export type DsChain = {
  // The queried name, lowercased and without a trailing dot. When it is not
  // a zone apex itself (a host, a wildcard, ...), the last zone is the one
  // it lives in.
  name: string;
  zones: DsChainZone[];
  verdict: DsChainVerdict;
  breakAt?: string;
};

// Answers must be decoded rdata owned by the queried name, as an
// authoritative server returns them; rcode tells NXDOMAIN from NODATA for
// the queried name itself. zone is the zone cut whose servers answered (the
// deepest delegation followed, '.' for the root). coveringRrsigs are the
// RRSIGs over the answered RRset, so the query must set the DNSSEC OK bit.
export type DsChainQuery = (
  name: string,
  type: Extract<RecordType, 'SOA' | 'DNSKEY' | 'DS'>,
) => Promise<{
  answers: Answer[];
  rcode?: string;
  zone: string;
  coveringRrsigs?: RrsigData[];
}>;

export class DsChainNameNotFoundError extends Error {}

// IANA root trust anchors: KSK-2017 and KSK-2024.
// https://data.iana.org/root-anchors/root-anchors.xml
const ROOT_ANCHORS: DsData[] = [
  {
    keyTag: 20326,
    algorithm: 8,
    digestType: 2,
    digest: Buffer.from(
      'E06D44B80B8F1D39A95C0B0D7C65D08458E880409BBC683457104237C7F8EC8D',
      'hex',
    ),
  },
  {
    keyTag: 38696,
    algorithm: 8,
    digestType: 2,
    digest: Buffer.from(
      '683D2D0ACB8C9B712A1948B27F741219298D0A450D612C483AF444A4C0FB2B16',
      'hex',
    ),
  },
];

const dnskeysOf = ({ answers }: { answers: Answer[] }): DnskeyData[] =>
  answers.flatMap((answer) => (answer.type === 'DNSKEY' ? [answer.data] : []));

const dsOf = ({ answers }: { answers: Answer[] }): DsData[] =>
  answers.flatMap((answer) => (answer.type === 'DS' ? [answer.data] : []));

const suffixesFor = (name: string): string[] => {
  const clean = name.replace(/^\*\./, '');
  const labels = clean && clean !== '.' ? clean.split('.') : [];
  if (labels.length > 16) {
    throw new UserFacingError({
      title: 'Domain name is too deep',
      description: 'DNSSEC chain lookups support up to 16 labels.',
    });
  }
  return ['.', ...labels.map((_, index) => labels.slice(-index - 1).join('.'))];
};

// `now` (Unix seconds) is the instant every signature is judged against.
export const resolveDsChain = async (
  domain: string,
  query: DsChainQuery,
  now = Math.floor(Date.now() / 1000),
): Promise<DsChain> => {
  const queried = canonicalDnsName(domain) || '.';
  const names = suffixesFor(queried);
  const zones: DsChainZone[] = [];
  let verdict: DsChainVerdict = 'intact';
  let breakAt: string | undefined;

  for (const [index, name] of names.entries()) {
    const isRoot = index === 0;
    const [soaResponse, keyResponse, dsResponse] = await Promise.all([
      isRoot ? null : query(name, 'SOA'),
      query(name, 'DNSKEY'),
      isRoot ? null : query(name, 'DS'),
    ]);
    if (
      index === names.length - 1 &&
      [soaResponse, keyResponse, dsResponse].some(
        (response) => response?.rcode === 'NXDOMAIN',
      )
    ) {
      throw new DsChainNameNotFoundError(name);
    }

    const keys = dnskeysOf(keyResponse);
    if (isRoot && keys.length === 0) {
      throw new UserFacingError({
        title: 'Root DNSKEY records unavailable',
        description:
          'The root DNSKEY lookup returned no keys. Please try again shortly.',
        retryable: true,
      });
    }
    const dsRecords = isRoot ? ROOT_ANCHORS : dsOf(dsResponse!);
    // Only zone apexes link the chain. A name is one when a parent delegates
    // it (the lookup was referred to its servers) or it has its own SOA or a
    // parent DS; a DNSKEY RRset alone does not make a zone cut. The SOA
    // covers parent and child sharing servers, where no referral happens; the
    // referral covers child servers that host no zone at the cut. Anything
    // else (a host, a CNAME, an empty non-terminal) lives inside the zone
    // above.
    const isApex =
      isRoot ||
      dsRecords.length > 0 ||
      [soaResponse, keyResponse, dsResponse].some(
        (response) => response?.zone === name,
      ) ||
      soaResponse!.answers.some((answer) => answer.type === 'SOA');
    if (!isApex) continue;
    const link = linkKeys(name, dsRecords, keys);

    let ownStatus: DsChainVerdict =
      link.status === 'linked' ? 'intact' : link.status;
    let keySignature: DsChainZone['keySignature'];
    if (link.status === 'linked' && verdict === 'intact') {
      // Only DS-linked keys may vouch for the key set: a zone must not
      // authenticate its DNSKEY RRset with a key nothing above it links.
      // Below a break nothing vouches for the DS itself, so there is no
      // trusted key to check against.
      const { outcome, rrsig } = checkRrsetSignatures({
        type: 'DNSKEY',
        rdatas: keys.map((key) => dnskeyRdata(key)),
        rrsigs: keyResponse.coveringRrsigs ?? [],
        ownerName: name,
        signerName: name,
        keys: link.linkedKeys,
        now,
      });
      keySignature = {
        outcome,
        ...(rrsig && {
          inception: rrsig.inception,
          expiration: rrsig.expiration,
        }),
      };
      ownStatus = outcome === 'valid' ? 'intact' : 'bad-signature';
    }
    if (verdict === 'intact' && ownStatus !== 'intact') {
      verdict = ownStatus;
      breakAt = name;
    }

    zones.push({
      name,
      keys: keys.map((key) => ({
        keyTag: dnskeyKeyTag(key),
        algorithm: key.algorithm,
        algorithmName: algorithmName(key.algorithm),
        isSep: isSepKey(key),
      })),
      dsRecords: dsRecords.map((ds, i) => ({
        keyTag: ds.keyTag,
        digestType: ds.digestType,
        digestHex: ds.digest.toString('hex').toUpperCase(),
        matched: link.matched[i],
        weakDigest: isWeakDigest(ds.digestType),
      })),
      ...(keySignature && { keySignature }),
      status: verdict,
    });
  }

  return {
    name: queried,
    zones,
    verdict,
    ...(breakAt ? { breakAt } : {}),
  };
};
