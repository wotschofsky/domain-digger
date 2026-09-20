import type { DnskeyData, DsData, RrsigData } from 'dns-packet';

import type { RecordType } from '@/lib/resolvers/base';
import { UserFacingError } from '@/lib/user-facing-error';
import { getBaseDomain } from '@/lib/utils';

import { buildChain } from './chain';
import { rrsetResult, signerId, validatePositiveRrset } from './rrset';
import type {
  DnssecAnswerRecord,
  DnssecChain,
  DnssecChainResult,
  DnssecCoverage,
  DnssecKey,
  DnssecQueryObservation,
  DnssecRrset,
  RawZone,
} from './types';
import { chainVerdict } from './verdict';
import { isEligibleSigner, normalizeDomain } from './wire';

// The DNSSEC chain walk, independent of DNS transport: callers inject a query
// function, so the walk is unit-testable and any resolver capable of returning
// DNSKEY/DS records with their RRSIGs can drive it.

export type DnssecQueryResult = {
  answers: DnssecAnswerRecord[];
  // The zone cut whose servers produced this answer: the deepest delegation
  // the transport followed, '.' for the root. The queried name is a zone cut
  // of its own exactly when this equals it -- which is what decides whether it
  // gets its own link in the chain. Guessing it from the records instead costs
  // a heuristic that cannot tell an unsigned delegation from an empty
  // non-terminal, so the transport must report it.
  zone: string;
  rcode?: string;
  // RRSIGs in the answer covering the queried type (present when queried with
  // the DNSSEC OK bit) -- they prove whether this RRset is signed.
  coveringRrsigs?: RrsigData[];
  // DNAMEs from the full answer section: CNAMEs at the queried name may be
  // synthesized and legitimately unsigned (RFC 6672 §3.2).
  dnames?: { name: string; target: string }[];
};

/**
 * Whether `cnameTarget` at `name` is exactly the CNAME a server would
 * synthesize from one of the answered DNAMEs (RFC 6672 §2.2): the name must
 * lie strictly below a DNAME owner, and the target must be the queried
 * prefix grafted onto the DNAME target. An unrelated DNAME in the answer
 * must not excuse an unsigned CNAME.
 */
export const isDnameSynthesized = (
  name: string,
  cnameTarget: string,
  dnames: { name: string; target: string }[],
): boolean => {
  const qname = normalizeDomain(name);
  const cname = normalizeDomain(cnameTarget);
  return dnames.some(({ name: owner, target }) => {
    const dnameOwner = normalizeDomain(owner);
    const dnameTarget = normalizeDomain(target);
    if (!dnameOwner || !qname.endsWith(`.${dnameOwner}`)) return false;
    const prefix = qname.slice(0, qname.length - dnameOwner.length - 1);
    return cname === (dnameTarget ? `${prefix}.${dnameTarget}` : prefix);
  });
};

/** One DNS question: name + type, optionally with the EDNS DNSSEC OK bit. */
export type DnssecQuery = (
  name: string,
  type: RecordType,
  dnssecOk?: boolean,
) => Promise<DnssecQueryResult>;

const isErrorRcode = (rcode: string | undefined): rcode is string =>
  rcode !== undefined && rcode !== 'NOERROR' && rcode !== 'NXDOMAIN';

const assertUsableDnssecResponse = (
  name: string,
  type: RecordType,
  result: DnssecQueryResult,
): void => {
  if (!isErrorRcode(result.rcode)) return;
  throw new UserFacingError(
    {
      title: 'Authoritative DNS servers returned an error',
      description: `The ${type} lookup for ${name} returned DNS ${result.rcode}, so the DNSSEC chain cannot be determined reliably. Please try again shortly.`,
      retryable: true,
    },
    { cause: new Error(`DNS ${result.rcode} for ${name} ${type}`) },
  );
};

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

// Bound total work, not just concurrency: a valid ~253-byte name can carry
// ~125 labels, which would mean hundreds of authoritative walks for one public
// request. Real DNSSEC hierarchies are far shallower.
const MAX_WALK_ZONES = 16;

/**
 * The most DNS questions one chain walk can ask: a DNSKEY and a DS per zone,
 * plus one probe per leaf RRset type. Transports size their own per-chain
 * allowance from this instead of restating the arithmetic, so adding a probe
 * type cannot silently invalidate a constant in another module.
 */
export const DNSSEC_CHAIN_QUERIES_MAX =
  MAX_WALK_ZONES * 2 + RRSET_PROBE_TYPES.length;

/**
 * Probe the queried name for common positive RRsets and validate each RRset's
 * covering RRSIG against the already-authenticated DNSKEYs of the signing
 * zone. Negative answers are only recorded as absent; NSEC/NSEC3 denial
 * proofs are a separate validation layer.
 */
const probeLeafRrsets = async (
  name: string,
  signerName: string,
  zoneKeys: DnskeyData[],
  authenticatedKeys: DnssecKey[],
  query: DnssecQuery,
  now: number,
): Promise<{
  rrsets: DnssecRrset[];
  observation: DnssecQueryObservation;
}> => {
  // Once the DNSKEY RRset has been authenticated by the chain, any key in that
  // validated key set may sign positive data RRsets. Most zones use a ZSK for
  // data, while only the KSK is directly DS-linked.
  const authenticatedKeyIds = new Set(
    authenticatedKeys
      .filter(isEligibleSigner)
      .map((key) => signerId(key.algorithm, key.keyTag)),
  );

  const probes = await Promise.all(
    RRSET_PROBE_TYPES.map((type) =>
      query(name, type, true)
        .then(({ answers, coveringRrsigs, rcode, dnames }) => {
          // Some injected transports return DNS error rcodes instead of
          // throwing. They are indeterminate lookups, never proof of NODATA.
          if (isErrorRcode(rcode)) {
            throw new Error(`DNS ${rcode} for ${name} ${type}`);
          }
          let rrset = validatePositiveRrset({
            type,
            ownerName: name,
            records: answers,
            rrsigs: coveringRrsigs ?? [],
            keys: zoneKeys,
            authenticatedKeyIds,
            signerName,
            now,
          });
          // A CNAME synthesized from a DNAME intentionally carries no RRSIG;
          // the signature lives on the DNAME (not validated here). Don't
          // misreport such deployments as serving unsigned records -- but
          // only when the CNAME really is the DNAME's substitution, so an
          // unrelated DNAME can't excuse a genuinely unsigned CNAME.
          const target = answers.find((a) => a.type === 'CNAME')?.data;
          if (
            rrset.reason === 'missing-rrsig' &&
            type === 'CNAME' &&
            typeof target === 'string' &&
            isDnameSynthesized(name, target, dnames ?? [])
          ) {
            rrset = rrsetResult('dname-synthesized', {
              type,
              recordCount: rrset.recordCount,
            });
          }
          // Surface the alias target: a validated CNAME only authenticates the
          // pointer, not the target's chain, and the UI must say so.
          if (type === 'CNAME' && typeof target === 'string') {
            rrset.cnameTarget = normalizeDomain(target);
          }
          return { rrset, rcode };
        })
        .catch(() => ({
          rrset: rrsetResult('lookup-failed', { type, recordCount: 0 }),
          rcode: undefined,
        })),
    ),
  );
  const results = probes.map(({ rrset }) => rrset);
  const observation: DnssecQueryObservation = results.some(
    (rrset) => rrset.recordCount > 0,
  )
    ? 'positive'
    : probes.some(({ rcode }) => rcode === 'NXDOMAIN')
      ? 'unproved-nxdomain'
      : // Any failed probe makes "no records observed" an overclaim: NODATA
        // is only reported when every probe actually answered.
        results.some((rrset) => rrset.status === 'indeterminate')
        ? 'indeterminate'
        : 'unproved-nodata';

  return { rrsets: results, observation };
};

/**
 * Resolve the DNSSEC authentication chain from the root down to the queried
 * name. For each zone we fetch its DNSKEYs and the DS the parent publishes for
 * it, then hand the raw records to buildChain() for verification. See index.ts
 * for what is (and isn't) verified.
 *
 * `now` (Unix seconds) is the instant RRSIG validity is judged against; it
 * defaults to the current time and is injectable for deterministic tests.
 */
export const resolveDnssecChain = async (
  domain: string,
  query: DnssecQuery,
  now?: number,
): Promise<DnssecChain> => {
  // Walk every label suffix from the root down to the queried name, so a
  // separately-delegated (and separately-signed) subdomain gets its own zone
  // cut evaluated instead of being collapsed into its registered domain.
  // Lowercase up front: DNS names are case-insensitive, but the query/answer
  // name comparison and the `name === base` leaf check below are not.
  // The zone walk strips a wildcard prefix (`*.` is not a zone cut), but the
  // leaf RRset probe must keep it: the user asked about the wildcard owner,
  // and its records differ from the parent name's.
  // One clock for the whole check: the chain and the leaf RRsets must be
  // judged against the same instant, or a signature can expire between them.
  const at = now ?? Math.floor(Date.now() / 1000);
  const probeName = normalizeDomain(domain);
  const fqdn = probeName.replace(/^\*\./, '');
  const base = getBaseDomain(fqdn);
  const labels = fqdn.split('.').filter(Boolean);

  const zoneNames = ['.'];
  for (let i = labels.length - 1; i >= 0; i--) {
    zoneNames.push(labels.slice(i).join('.'));
  }
  // e.g. www.wsky.dev -> ['.', 'dev', 'wsky.dev', 'www.wsky.dev']

  if (zoneNames.length > MAX_WALK_ZONES) {
    throw new UserFacingError({
      title: 'Domain has too many labels',
      description: `DNSSEC chain walks are limited to ${MAX_WALK_ZONES - 1} labels to keep a lookup's DNS traffic bounded.`,
      retryable: false,
    });
  }

  // Zones are independent questions, so fetch them concurrently. Failures
  // (timeouts, blocked UDP, bad referrals) must propagate to the error
  // boundary -- they are NOT an unsigned zone, which comes back as an empty
  // (non-throwing) answer set. Swallowing them would render a confident but
  // false "insecure".
  const fetchZone = async (name: string) => {
    const [keyResult, dsResult] = await Promise.all([
      // DO bit set so the DNSKEY RRset's covering RRSIGs come back -- we
      // cryptographically verify the key set is validly signed, not just
      // digest-linked.
      query(name, 'DNSKEY', true),
      // The root has no parent to publish a DS; its anchors are built in.
      name === '.'
        ? Promise.resolve<DnssecQueryResult>({ answers: [], zone: '.' })
        : query(name, 'DS', true),
    ]);
    assertUsableDnssecResponse(name, 'DNSKEY', keyResult);
    if (name !== '.') assertUsableDnssecResponse(name, 'DS', dsResult);
    return { name, keyResult, dsResult };
  };
  // Bound the fan-out: a crafted many-label name would otherwise launch a
  // root-down walk per suffix all at once (~250 concurrent lookups for a
  // 253-byte name) on a public route. Typical domains fit in one chunk.
  // ponytail: fixed-size chunks; a sliding-window pool if tail latency matters.
  const CONCURRENT_ZONES = 6;
  const zoneRecords: Awaited<ReturnType<typeof fetchZone>>[] = [];
  for (let i = 0; i < zoneNames.length; i += CONCURRENT_ZONES) {
    zoneRecords.push(
      ...(await Promise.all(
        zoneNames.slice(i, i + CONCURRENT_ZONES).map(fetchZone),
      )),
    );
  }

  const candidates = zoneRecords.map(({ name, keyResult, dsResult }) => ({
    name,
    keys: keyResult.answers
      .filter((a) => a.type === 'DNSKEY')
      .map((a) => a.data as DnskeyData),
    dsRecords: dsResult.answers
      .filter((a) => a.type === 'DS')
      .map((a) => a.data as DsData),
    keyRrsigs: keyResult.coveringRrsigs,
    dsRrsigs: dsResult.coveringRrsigs,
  }));

  // Keep the root, the registered domain (so unsigned domains still render an
  // honest "insecure"), and every label that is genuinely its own zone cut --
  // which the DNSKEY answer reports directly, because the servers that
  // answered it are the ones delegated for that name. A plain subdomain is
  // answered by its enclosing zone and is dropped; an unsigned delegation is
  // answered by its own servers and is kept, so a signed island below it is
  // not grafted onto its grandparent and misvalidated against the wrong keys.
  // (A TRAILING unsigned sub-delegation is still dropped by buildChain's
  // leaf handling; see the limitation in index.ts.)
  const keep = zoneRecords.map(
    ({ name, keyResult }) =>
      name === '.' ||
      name === base ||
      normalizeDomain(keyResult.zone) === normalizeDomain(name),
  );
  const rawZones: RawZone[] = candidates.filter((_, index) => keep[index]);

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

  const walked = buildChain(rawZones, at);

  const exactZoneResult =
    probeName === fqdn
      ? zoneRecords.find(({ name }) => name === fqdn)
      : undefined;
  // DNSKEY/DS questions for the exact name may already have observed NXDOMAIN.
  let observation: DnssecQueryObservation =
    exactZoneResult?.keyResult.rcode === 'NXDOMAIN' ||
    exactZoneResult?.dsResult.rcode === 'NXDOMAIN'
      ? 'unproved-nxdomain'
      : 'not-checked';

  // Probe the leaf for positive RRsets (the "what's protected" list on the
  // chain's bottom card). Only meaningful once the key chain validates to the
  // signing zone.
  const leaf = walked.zones.at(-1);
  const leafRaw = leaf
    ? rawZones.find((zone) => zone.name === leaf.name)
    : undefined;

  let zones = walked.zones;
  let coverage: DnssecCoverage = { checkedPositiveRrsetTypes: [] };
  let leafAlias: string | undefined;

  if (leaf && leafRaw && leaf.status === 'secure') {
    coverage = { checkedPositiveRrsetTypes: [...RRSET_PROBE_TYPES] };
    const probed = await probeLeafRrsets(
      probeName,
      leaf.name,
      leafRaw.keys,
      leaf.keys,
      query,
      at,
    );
    // Do not erase a stronger negative response merely because a later type
    // probe came back as NODATA; a positive answer does override it.
    if (
      observation !== 'unproved-nxdomain' ||
      probed.observation === 'positive'
    )
      observation = probed.observation;
    zones = zones.map((zone, index) =>
      index === zones.length - 1 ? { ...zone, rrsets: probed.rrsets } : zone,
    );
    leafAlias = probed.rrsets.find(
      (rrset) => rrset.type === 'CNAME',
    )?.cnameTarget;
  }

  const result: DnssecChainResult = { ...walked, zones };
  return {
    ...result,
    coverage,
    query: { name: probeName, observation },
    leafAlias,
    verdict: chainVerdict(result, observation),
  };
};
