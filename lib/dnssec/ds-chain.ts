import { createHash } from 'node:crypto';

import type { Answer, DnskeyData, DsData } from 'dns-packet';

import type { RecordType } from '@/lib/resolvers/base';
import { UserFacingError } from '@/lib/user-facing-error';

export type DsChainVerdict = 'intact' | 'unsigned' | 'mismatch';

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
// deepest delegation followed, '.' for the root).
export type DsChainQuery = (
  name: string,
  type: Extract<RecordType, 'SOA' | 'DNSKEY' | 'DS'>,
) => Promise<{ answers: Answer[]; rcode?: string; zone: string }>;

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

const ALGORITHM_NAMES: Record<number, string> = {
  1: 'RSAMD5',
  3: 'DSA',
  5: 'RSASHA1',
  6: 'DSA-NSEC3-SHA1',
  7: 'RSASHA1-NSEC3-SHA1',
  8: 'RSASHA256',
  10: 'RSASHA512',
  12: 'ECC-GOST',
  13: 'ECDSAP256SHA256',
  14: 'ECDSAP384SHA384',
  15: 'ED25519',
  16: 'ED448',
};

export const dnssecAlgorithmName = (algorithm: number): string =>
  ALGORITHM_NAMES[algorithm] ?? `Algorithm ${algorithm}`;

export const dsDigestName = (digestType: number): string =>
  ({ 1: 'SHA-1', 2: 'SHA-256', 3: 'GOST R 34.11-94', 4: 'SHA-384' })[
    digestType
  ] ?? `Digest ${digestType}`;

const HASH_ALGORITHMS: Record<number, string> = {
  1: 'sha1',
  2: 'sha256',
  4: 'sha384',
};

const wireName = (name: string): Buffer => {
  if (name === '.') return Buffer.from([0]);
  return Buffer.concat([
    ...name
      .toLowerCase()
      .split('.')
      .flatMap((label) => [
        Buffer.from([Buffer.byteLength(label, 'ascii')]),
        Buffer.from(label, 'ascii'),
      ]),
    Buffer.from([0]),
  ]);
};

const dnskeyRdata = (key: DnskeyData): Buffer => {
  const header = Buffer.alloc(4);
  header.writeUInt16BE(key.flags, 0);
  header.writeUInt8(3, 2);
  header.writeUInt8(key.algorithm, 3);
  return Buffer.concat([header, key.key]);
};

const keyTag = (key: DnskeyData): number => {
  const rdata = dnskeyRdata(key);
  // RFC 4034 Appendix B.1 has a special case for the obsolete RSAMD5 key.
  if (key.algorithm === 1) return (rdata.at(-3)! << 8) | rdata.at(-2)!;
  let sum = 0;
  for (let i = 0; i < rdata.length; i++) {
    sum += i & 1 ? rdata[i] : rdata[i] << 8;
  }
  sum += (sum >> 16) & 0xffff;
  return sum & 0xffff;
};

const dsMatchesKey = (ds: DsData, key: DnskeyData, name: string): boolean => {
  // A DS may only point at a key with the Zone Key flag (RFC 4034 section 5.2).
  if ((key.flags & 0x0100) === 0) return false;
  if (ds.keyTag !== keyTag(key) || ds.algorithm !== key.algorithm) return false;
  const hash = HASH_ALGORITHMS[ds.digestType];
  if (!hash) return false;
  return createHash(hash)
    .update(Buffer.concat([wireName(name), dnskeyRdata(key)]))
    .digest()
    .equals(ds.digest);
};

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

export const resolveDsChain = async (
  domain: string,
  query: DsChainQuery,
): Promise<DsChain> => {
  const queried = domain.toLowerCase().replace(/\.$/, '') || '.';
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
    const matches = dsRecords.map((ds) =>
      keys.some((key) => dsMatchesKey(ds, key, name)),
    );
    // Only supported digests decide, and SHA-1 is ignored next to a stronger
    // one (RFC 4509 section 3), so a matching SHA-1 record cannot hide a
    // broken stronger digest. With no supported digest the zone cannot be
    // authenticated and counts as unsigned (RFC 4035 section 5.2).
    const supported = dsRecords.flatMap((ds, i) =>
      HASH_ALGORITHMS[ds.digestType] ? [{ ds, matched: matches[i] }] : [],
    );
    const hasStrong = supported.some(({ ds }) => ds.digestType !== 1);
    const deciding = supported.filter(
      ({ ds }) => !hasStrong || ds.digestType !== 1,
    );
    const ownStatus: DsChainVerdict =
      deciding.length === 0
        ? 'unsigned'
        : deciding.some(({ matched }) => matched)
          ? 'intact'
          : 'mismatch';
    if (verdict === 'intact' && ownStatus !== 'intact') {
      verdict = ownStatus;
      breakAt = name;
    }

    zones.push({
      name,
      keys: keys.map((key) => ({
        keyTag: keyTag(key),
        algorithm: key.algorithm,
        algorithmName: dnssecAlgorithmName(key.algorithm),
        isSep: (key.flags & 1) !== 0,
      })),
      dsRecords: dsRecords.map((ds, i) => ({
        keyTag: ds.keyTag,
        digestType: ds.digestType,
        digestHex: ds.digest.toString('hex').toUpperCase(),
        matched: matches[i],
        weakDigest: ds.digestType === 1 || ds.digestType === 3,
      })),
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
