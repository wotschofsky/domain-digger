import type { DnskeyData, DsData, RrsigData } from 'dns-packet';

import type { RecordType } from '@/lib/resolvers/base';
import { UserFacingError } from '@/lib/user-facing-error';
import { getBaseDomain } from '@/lib/utils';

import { buildChain } from './chain';
import { rrsetResult, signerId, validatePositiveRrset } from './rrset';
import type {
  DnssecAnswerRecord,
  DnssecChain,
  DnssecKey,
  DnssecRrset,
  RawZone,
} from './types';

// The DNSSEC chain walk, independent of DNS transport: callers inject a query
// function, so the walk is unit-testable and any resolver capable of returning
// DNSKEY/DS records with their RRSIGs can drive it.

export type DnssecQueryResult = {
  answers: DnssecAnswerRecord[];
  rcode?: string;
  // RRSIGs in the answer covering the queried type (present when queried with
  // the DNSSEC OK bit) -- they prove whether this RRset is signed.
  coveringRrsigs?: RrsigData[];
};

/** One DNS question: name + type, optionally with the EDNS DNSSEC OK bit. */
export type DnssecQuery = (
  name: string,
  type: RecordType,
  dnssecOk?: boolean,
) => Promise<DnssecQueryResult>;

// Common record types probed at the queried leaf to list its signed RRsets.
// Infra types (DNSKEY/DS/RRSIG) and reverse-only PTR are intentionally left out.
const RRSET_PROBE_TYPES: RecordType[] = [
  'SOA',
  'A',
  'AAAA',
  'NS',
  'MX',
  'TXT',
  'CAA',
  'SRV',
  'NAPTR',
  'CNAME',
];

/**
 * Probe the queried name for common positive RRsets and validate each RRset's
 * covering RRSIG against the already-authenticated DNSKEYs of the signing
 * zone. Negative answers are only recorded as absent; NSEC/NSEC3 denial
 * proofs are a separate validation layer.
 */
async function probeLeafRrsets(
  name: string,
  signerName: string,
  zoneKeys: DnskeyData[],
  authenticatedKeys: DnssecKey[],
  query: DnssecQuery,
  now?: number,
): Promise<{ rrsets: DnssecRrset[]; expiresAt?: number }> {
  // Once the DNSKEY RRset has been authenticated by the chain, any key in that
  // validated key set may sign positive data RRsets. Most zones use a ZSK for
  // data, while only the KSK is directly DS-linked.
  const authenticatedKeyIds = new Set(
    authenticatedKeys.map((key) => signerId(key.algorithm, key.keyTag)),
  );

  const results = await Promise.all(
    RRSET_PROBE_TYPES.map((type) =>
      query(name, type, true)
        .then(({ answers, coveringRrsigs }) => {
          const rrset = validatePositiveRrset({
            type,
            ownerName: name,
            records: answers,
            rrsigs: coveringRrsigs ?? [],
            keys: zoneKeys,
            authenticatedKeyIds,
            signerName,
            now,
          });
          // Surface the alias target: a validated CNAME only authenticates the
          // pointer, not the target's chain, and the UI must say so.
          const target = answers.find((a) => a.type === 'CNAME')?.data;
          if (type === 'CNAME' && typeof target === 'string') {
            rrset.cnameTarget = target.replace(/\.$/, '').toLowerCase();
          }
          return rrset;
        })
        .catch(() => rrsetResult('lookup-failed', { type, recordCount: 0 })),
    ),
  );

  // Only validated RRsets speak for the domain's signature freshness: a bogus
  // RRset also carries a (possibly long-past) expiry, and letting it into the
  // min would flip the domain-wide chip to "expired" on otherwise-valid data.
  const expiries = results
    .filter((r) => r.status === 'secure')
    .map((r) => r.signatureExpiresAt)
    .filter((e): e is number => typeof e === 'number');
  return {
    rrsets: results,
    expiresAt: expiries.length ? Math.min(...expiries) : undefined,
  };
}

/**
 * Resolve the DNSSEC authentication chain from the root down to the queried
 * name. For each zone we fetch its DNSKEYs and the DS the parent publishes for
 * it, then hand the raw records to buildChain() for verification. See index.ts
 * for what is (and isn't) verified.
 *
 * `now` (Unix seconds) is the instant RRSIG validity is judged against; it
 * defaults to the current time and is injectable for deterministic tests.
 */
export async function resolveDnssecChain(
  domain: string,
  query: DnssecQuery,
  now?: number,
): Promise<DnssecChain> {
  // Walk every label suffix from the root down to the queried name, so a
  // separately-delegated (and separately-signed) subdomain gets its own zone
  // cut evaluated instead of being collapsed into its registered domain.
  // Lowercase up front: DNS names are case-insensitive, but the query/answer
  // name comparison and the `name === base` leaf check below are not.
  // The zone walk strips a wildcard prefix (`*.` is not a zone cut), but the
  // leaf RRset probe must keep it: the user asked about the wildcard owner,
  // and its records differ from the parent name's.
  const probeName = domain.replace(/\.$/, '').toLowerCase();
  const fqdn = probeName.replace(/^\*\./, '');
  const base = getBaseDomain(fqdn);
  const labels = fqdn.split('.').filter(Boolean);

  const zoneNames = ['.'];
  for (let i = labels.length - 1; i >= 0; i--) {
    zoneNames.push(labels.slice(i).join('.'));
  }
  // e.g. www.wsky.dev -> ['.', 'dev', 'wsky.dev', 'www.wsky.dev']

  // Zones are independent questions, so fetch them all concurrently. Failures
  // (timeouts, blocked UDP, bad referrals) must propagate to the error
  // boundary -- they are NOT an unsigned zone, which comes back as an empty
  // (non-throwing) answer set. Swallowing them would render a confident but
  // false "insecure".
  const zoneRecords = await Promise.all(
    zoneNames.map(async (name) => {
      const [keyResult, dsResult] = await Promise.all([
        // DO bit set so the DNSKEY RRset's covering RRSIGs come back -- we
        // cryptographically verify the key set is validly signed, not just
        // digest-linked.
        query(name, 'DNSKEY', true),
        // The root has no parent to publish a DS; its anchors are built in.
        name === '.'
          ? Promise.resolve<DnssecQueryResult>({ answers: [] })
          : query(name, 'DS', true),
      ]);
      return { name, keyResult, dsResult };
    }),
  );

  const rawZones: RawZone[] = [];
  for (const { name, keyResult, dsResult } of zoneRecords) {
    const keys = keyResult.answers
      .filter((a) => a.type === 'DNSKEY')
      .map((a) => a.data as DnskeyData);
    const dsRecords = dsResult.answers
      .filter((a) => a.type === 'DS')
      .map((a) => a.data as DsData);

    // Keep the root, the registered domain (so unsigned domains still render
    // an honest "insecure"), and any deeper label that is an actual zone cut
    // (publishes DNSKEY/DS). Plain subdomains of a signed zone carry no keys
    // of their own and are dropped -- they are covered by that zone. (An
    // unsigned sub-delegation is also dropped here; see the limitation note
    // in index.ts.)
    if (name === '.' || name === base || keys.length || dsRecords.length) {
      rawZones.push({
        name,
        keys,
        dsRecords,
        keyRrsigs: keyResult.coveringRrsigs,
        dsRrsigs: dsResult.coveringRrsigs,
      });
    }
  }

  // The signed root zone always serves DNSKEY records. Getting none back means
  // our path to DNS is compromised -- typically a network that intercepts
  // port 53 and answers queries itself with empty NODATA responses. Any
  // verdict built on that is false (it would render a bogus-looking
  // "broken"), so fail loudly and retryably instead of lying.
  const rootZone = rawZones.find((z) => z.name === '.');
  if (!rootZone || rootZone.keys.length === 0) {
    throw new UserFacingError({
      title: "Couldn't retrieve the root zone's DNSSEC keys",
      description:
        'We could not fetch the signed root zone (DNSKEY) needed to validate the chain. This usually means the network is blocking or intercepting direct DNS queries. Please try again in a moment.',
      retryable: true,
    });
  }

  const chain = buildChain(rawZones, now);

  // Enrich the leaf with positive RRset validation results (the "what's
  // protected" list shown on the chain's bottom card). This is only meaningful
  // when the key chain validates to the signing zone.
  const leaf = chain.zones.at(-1);
  const leafRaw = leaf
    ? rawZones.find((zone) => zone.name === leaf.name)
    : null;
  if (leaf && leafRaw && leaf.status === 'secure') {
    chain.coverage.checkedPositiveRrsetTypes = [...RRSET_PROBE_TYPES];
    const { rrsets, expiresAt } = await probeLeafRrsets(
      probeName,
      leaf.name,
      leafRaw.keys,
      leaf.keys,
      query,
      now,
    );
    leaf.rrsets = rrsets;
    // The leaf's freshness is the earliest of its DNSKEY RRSIG expiry (set by
    // buildChain) and its validated positive RRsets' expiries.
    if (expiresAt !== undefined) {
      leaf.signatureExpiresAt = Math.min(
        leaf.signatureExpiresAt ?? Infinity,
        expiresAt,
      );
    }
  }

  return chain;
}
