import { createHash } from 'node:crypto';

import type { DnskeyData, DsData } from 'dns-packet';

import type { RecordType, ResolverResponse } from '@/lib/resolvers/base';
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
  zones: DsChainZone[];
  verdict: DsChainVerdict;
  breakAt?: string;
};

export type DsChainQuery = (
  name: string,
  type: Extract<RecordType, 'DNSKEY' | 'DS'>,
) => Promise<Pick<ResolverResponse, 'records' | 'rcode'>>;

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
  if (ds.keyTag !== keyTag(key) || ds.algorithm !== key.algorithm) return false;
  const hash = HASH_ALGORITHMS[ds.digestType];
  if (!hash) return false;
  return createHash(hash)
    .update(Buffer.concat([wireName(name), dnskeyRdata(key)]))
    .digest()
    .equals(ds.digest);
};

const parseKeys = (response: Pick<ResolverResponse, 'records'>): DnskeyData[] =>
  response.records.flatMap(({ data }) => {
    const match = /^(\d+)\s+(\d+)\s+([A-Za-z0-9+/]+={0,2})$/.exec(data);
    if (!match) return [];
    return [
      {
        flags: Number(match[1]),
        algorithm: Number(match[2]),
        key: Buffer.from(match[3], 'base64'),
      },
    ];
  });

const parseDs = (response: Pick<ResolverResponse, 'records'>): DsData[] =>
  response.records.flatMap(({ data }) => {
    const match = /^(\d+)\s+(\d+)\s+(\d+)\s+([\da-fA-F]+)$/.exec(data);
    if (!match) return [];
    return [
      {
        keyTag: Number(match[1]),
        algorithm: Number(match[2]),
        digestType: Number(match[3]),
        digest: Buffer.from(match[4], 'hex'),
      },
    ];
  });

const suffixesFor = (domain: string): string[] => {
  const clean = domain.toLowerCase().replace(/\.$/, '').replace(/^\*\./, '');
  const labels = clean ? clean.split('.') : [];
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
  const names = suffixesFor(domain);
  const zones: DsChainZone[] = [];
  let verdict: DsChainVerdict = 'intact';
  let breakAt: string | undefined;

  for (const [index, name] of names.entries()) {
    const [keyResponse, dsResponse] = await Promise.all([
      query(name, 'DNSKEY'),
      index === 0 ? Promise.resolve(null) : query(name, 'DS'),
    ]);
    if (
      index === names.length - 1 &&
      (keyResponse.rcode === 'NXDOMAIN' || dsResponse?.rcode === 'NXDOMAIN')
    ) {
      throw new DsChainNameNotFoundError(name);
    }

    const keys = parseKeys(keyResponse);
    if (index === 0 && keys.length === 0) {
      throw new UserFacingError({
        title: 'Root DNSKEY records unavailable',
        description:
          'The root DNSKEY lookup returned no keys. Please try again shortly.',
        retryable: true,
      });
    }
    const dsRecords = index === 0 ? ROOT_ANCHORS : parseDs(dsResponse!);
    const matches = dsRecords.map((ds) =>
      keys.some((key) => dsMatchesKey(ds, key, name)),
    );
    // If a parent publishes SHA-256 DS records, use those for the decision.
    // A matching SHA-1 record cannot hide a broken stronger digest.
    const preferred = dsRecords.some((ds) => ds.digestType === 2)
      ? dsRecords.flatMap((ds, i) => (ds.digestType === 2 ? [matches[i]] : []))
      : matches;
    const ownStatus: DsChainVerdict =
      dsRecords.length === 0
        ? 'unsigned'
        : preferred.some(Boolean)
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

  return { zones, verdict, ...(breakAt ? { breakAt } : {}) };
};
