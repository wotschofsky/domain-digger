import dgram from 'node:dgram';
import net from 'node:net';

import DataLoader from 'dataloader';
import dnsPacket, {
  type Answer,
  type DecodedPacket,
  type DnskeyData,
  type DsData,
  type Packet,
  type Question,
  type RrsigData,
  type StringAnswer,
} from 'dns-packet';

import {
  buildChain,
  type DnssecChain,
  type DnssecKey,
  type DnssecRrset,
  type RawZone,
  signerId,
  validatePositiveRrset,
} from '@/lib/dnssec';
import { getBaseDomain, retry } from '@/lib/utils';

import { UserFacingError } from '../user-facing-error';
import {
  DnsResolver,
  type RawRecord,
  type RecordType,
  type ResolverResponse,
} from './base';
import { isPublicIp } from './ip-filter';

type RawAnswer = Extract<Answer, { type: RecordType }>;

// EDNS OPT pseudo-record carrying the DNSSEC OK (DO) bit, so the server
// returns RRSIG records alongside the answer.
const DNSSEC_OPT_RECORD = {
  type: 'OPT' as const,
  name: '.',
  udpPayloadSize: 4096,
  extendedRcode: 0,
  ednsVersion: 0,
  flags: dnsPacket.DNSSEC_OK,
  flag_do: true,
  options: [],
};

type DnsResponse = {
  packet: Packet;
  protocol: 'udp' | 'tcp';
  truncated: boolean;
};

type FetchRecordsParams = {
  domain: string;
  recordType: RecordType;
  nameserver?: string;
  nameservers?: string[];
  trace?: string[];
  depth?: number;
  // Set the EDNS DNSSEC OK (DO) bit so authoritative servers include RRSIGs.
  // Used by the leaf RRset probe to observe which record sets are signed.
  dnssecOk?: boolean;
};

export class AuthoritativeResolver extends DnsResolver {
  private static readonly MAX_RECURSION_DEPTH = 20;

  // Common record types probed at the queried leaf to list its signed RRsets.
  // Infra types (DNSKEY/DS/RRSIG) and reverse-only PTR are intentionally left out.
  private static readonly RRSET_PROBE_TYPES: RecordType[] = [
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

  // One fetch+parse of the root hints per resolver instance; the walk calls
  // getRootServers on every recursion step. A failed attempt is not cached.
  private rootServersPromise?: Promise<string[]>;

  private getRootServers(): Promise<string[]> {
    this.rootServersPromise ??= this.fetchRootServers().catch((error) => {
      this.rootServersPromise = undefined;
      throw error;
    });
    return this.rootServersPromise;
  }

  private async fetchRootServers() {
    let response: Response;
    try {
      response = await fetch('https://www.internic.net/domain/named.root', {
        next: {
          revalidate: 7 * 24 * 60 * 60,
        },
      });
    } catch (error) {
      throw new UserFacingError(
        {
          title: "Couldn't reach InterNIC root servers list",
          description:
            "We couldn't complete the request to the InterNIC root servers list. Please try again shortly.",
          retryable: true,
        },
        { cause: error },
      );
    }
    if (!response.ok) {
      throw new UserFacingError(
        {
          title: 'InterNIC root servers list is unavailable',
          description:
            'The InterNIC root servers list returned an error and may be temporarily down. Please try again shortly.',
          retryable: true,
        },
        {
          cause: new Error(
            `Failed to fetch root servers: HTTP ${response.status}`,
          ),
        },
      );
    }
    const body = await response.text();

    // TODO Support IPv6
    const aRecords = body.match(/\sA\s+(.+)/g);

    if (!aRecords) {
      throw new UserFacingError(
        {
          title: "Couldn't reach InterNIC root servers list",
          description:
            "We couldn't complete the request to the InterNIC root servers list. Please try again shortly.",
          retryable: true,
        },
        { cause: new Error('Failed to parse root servers') },
      );
    }

    const ipAddresses = aRecords?.map(
      (l) => l.replaceAll(/\s+/g, ' ').split(' ')[2],
    );

    return ipAddresses;
  }

  private recordToString(record: Answer): string {
    switch (record.type) {
      case 'A':
      case 'AAAA':
      case 'CNAME':
      case 'DNAME':
      case 'PTR':
        return record.data;
      case 'TXT':
        if (Array.isArray(record.data)) {
          return record.data
            .map((item) => (item instanceof Buffer ? item.toString() : item))
            .join(' ');
        } else if (record.data instanceof Buffer) {
          return record.data.toString();
        } else {
          return record.data.toString();
        }
      case 'CAA':
        return `${record.data.flags} ${record.data.tag} "${record.data.value}"`;
      case 'DNSKEY':
        return `${record.data.flags} ${
          record.data.algorithm
        } ${record.data.key.toString('base64')}`;
      case 'DS':
        return `${record.data.keyTag} ${record.data.algorithm} ${
          record.data.digestType
        } ${record.data.digest.toString('hex').toUpperCase()}`;
      case 'MX':
        return `${record.data.preference} ${record.data.exchange}`;
      case 'NAPTR':
        return `${record.data.order} ${record.data.preference} "${record.data.flags}" "${record.data.services}" "${record.data.regexp}" ${record.data.replacement}`;
      case 'NS':
        return record.data;
      case 'RRSIG':
        return `${record.data.typeCovered} ${record.data.algorithm} ${record.data.labels} ${record.data.originalTTL} ${record.data.expiration} ${record.data.inception} ${record.data.keyTag} ${record.data.signersName} ${record.data.signature.toString('base64')}`;
      case 'SOA':
        return `${record.data.mname} ${record.data.rname} ${record.data.serial} ${record.data.refresh} ${record.data.retry} ${record.data.expire} ${record.data.minimum}`;
      case 'SRV':
        return `${record.data.priority} ${record.data.weight} ${record.data.port} ${record.data.target}`;
      default:
        return 'Unknown Record Type';
    }
  }

  private async sendUdpRequest(
    domain: string,
    recordType: RecordType,
    nameserver: string,
    dnssecOk = false,
  ) {
    const packetBuffer = dnsPacket.encode({
      type: 'query',
      // Randomize ID to avoid response mismatch
      id: Math.floor(Math.random() * 65535),
      questions: [{ type: recordType, name: domain } as Question],
      ...(dnssecOk && { additionals: [DNSSEC_OPT_RECORD] }),
    });

    return new Promise<DecodedPacket>((resolve, reject) => {
      const socket = dgram.createSocket('udp4');

      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.close();
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Request to ${nameserver} for domain ${domain}, type ${recordType} timed out after 3000ms`,
          ),
        );
      }, 3000);

      socket.on('message', (message: Buffer) => {
        cleanup();
        resolve(dnsPacket.decode(message));
      });
      socket.on('error', (error) => {
        cleanup();
        reject(error);
      });

      socket.send(packetBuffer, 0, packetBuffer.length, 53, nameserver);
    });
  }

  private async sendTcpRequest(
    domain: string,
    recordType: RecordType,
    nameserver: string,
    dnssecOk = false,
  ) {
    const packetBuffer = dnsPacket.streamEncode({
      type: 'query',
      id: Math.floor(Math.random() * 65535),
      questions: [{ type: recordType, name: domain } as Question],
      ...(dnssecOk && { additionals: [DNSSEC_OPT_RECORD] }),
    });

    return new Promise<Packet>((resolve, reject) => {
      const socket = net.createConnection(53, nameserver, () => {
        socket.write(packetBuffer);
      });

      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.destroy();
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `TCP request to ${nameserver} for domain ${domain}, type ${recordType} timed out after 3000ms`,
          ),
        );
      }, 3000);

      const chunks: Buffer[] = [];
      socket.on('data', (data: Buffer) => {
        chunks.push(data);
        const buf = Buffer.concat(chunks);
        // TCP DNS messages are prefixed with a 2-byte length field
        if (buf.length >= 2) {
          const msgLen = buf.readUInt16BE(0);
          if (buf.length >= 2 + msgLen) {
            cleanup();
            resolve(dnsPacket.streamDecode(buf));
          }
        }
      });
      socket.on('error', (error) => {
        cleanup();
        reject(error);
      });
    });
  }

  private async sendRequest(
    domain: string,
    recordType: RecordType,
    nameserver: string,
    dnssecOk = false,
  ) {
    // DNS queries are first attempted over UDP per convention. However, UDP
    // responses are limited to 512 bytes (RFC 1035). When the answer exceeds
    // that limit the server truncates the response and sets the TC flag,
    // signaling the client to retry over TCP where the full response (up to
    // 64 KB) can be delivered.
    const udpResponse = await this.sendUdpRequest(
      domain,
      recordType,
      nameserver,
      dnssecOk,
    );
    if (udpResponse.flag_tc) {
      const packet = await this.sendTcpRequest(
        domain,
        recordType,
        nameserver,
        dnssecOk,
      );
      return { packet, protocol: 'tcp', truncated: true };
    }
    return { packet: udpResponse, protocol: 'udp', truncated: false };
  }

  private requestLoader = new DataLoader<
    {
      domain: string;
      type: RecordType;
      nameserver: string;
      dnssecOk: boolean;
    },
    DnsResponse,
    string
  >(
    async (keys) =>
      Promise.all(
        keys.map(async ({ domain, type, nameserver, dnssecOk }) => {
          try {
            return await retry(
              () => this.sendRequest(domain, type, nameserver, dnssecOk),
              3,
            );
          } catch (error) {
            return error instanceof Error
              ? error
              : new Error('DNS request failed');
          }
        }),
      ),
    {
      cacheKeyFn: (key) => JSON.stringify(key),
    },
  );

  // Zone cut -> public nameserver IPs learned from referrals during this
  // instance's walks. Later queries for names under an already-discovered zone
  // start there instead of re-walking from the root -- the DataLoader can't
  // dedupe those shared hops because its key includes the final query name.
  // First writer wins and only suffixes of the queried name are cached, so a
  // deeper (less-trusted) server can't overwrite entries learned from the
  // servers above it.
  private delegationCache = new Map<string, string[]>();

  private cacheDelegation(zoneCut: string, domain: string, ips: string[]) {
    const zone = zoneCut.toLowerCase();
    const name = domain.toLowerCase();
    if (this.delegationCache.has(zone)) return;
    if (name !== zone && !name.endsWith(`.${zone}`)) return;
    this.delegationCache.set(zone, ips);
  }

  private cachedDelegation(
    domain: string,
    recordType: RecordType,
  ): string[] | undefined {
    const labels = domain.toLowerCase().split('.').filter(Boolean);
    // DS records live in the parent zone: a child's own servers answer a DS
    // query for their apex with NODATA, which would falsely read as "no DS".
    // Skip the exact-name entry and start at the parent.
    const start = recordType === 'DS' ? 1 : 0;
    for (let i = start; i < labels.length; i++) {
      const hit = this.delegationCache.get(labels.slice(i).join('.'));
      if (hit) return hit;
    }
    return undefined;
  }

  private async fetchRecordsRaw({
    domain,
    recordType,
    nameserver,
    nameservers,
    trace = [],
    depth = 0,
    dnssecOk = false,
  }: FetchRecordsParams): Promise<{
    answers: RawAnswer[];
    trace: string[];
    rcode?: string;
    // The RRSIG records covering recordType, for cryptographic verification
    // (populated only when queried with dnssecOk).
    coveringRrsigs?: RrsigData[];
  }> {
    if (depth > AuthoritativeResolver.MAX_RECURSION_DEPTH) {
      throw new Error(
        `Max recursion depth exceeded while resolving ${domain} (type ${recordType})`,
      );
    }

    const candidateNameservers =
      nameservers && nameservers.length
        ? nameservers
        : nameserver
          ? [nameserver]
          : (this.cachedDelegation(domain, recordType) ??
            (await this.getRootServers()).slice(0, 4));
    let response: Packet | null = null;
    let protocol: DnsResponse['protocol'] = 'udp';
    let truncated = false;
    let usedNameserver = candidateNameservers[0];
    const failedNameservers: string[] = [];

    for (const candidate of candidateNameservers) {
      const loaderKey = {
        domain,
        type: recordType,
        nameserver: candidate,
        dnssecOk,
      };
      try {
        const result = await this.requestLoader.load(loaderKey);
        response = result.packet;
        protocol = result.protocol;
        truncated = result.truncated;
        usedNameserver = candidate;
        break;
      } catch (error) {
        // DataLoader caches rejections; clear the key so a transient failure
        // doesn't poison every later identical query in this walk.
        this.requestLoader.clear(loaderKey);
        failedNameservers.push(
          `${candidate}: ${error instanceof Error ? error.message : 'request failed'}`,
        );
      }
    }

    if (!response) {
      throw new Error(
        `All nameservers failed for ${domain} ${recordType}: ${failedNameservers.join('; ')}`,
      );
    }

    if (failedNameservers.length) {
      trace = [
        ...trace,
        `${recordType} ${domain} -> skipped failed nameservers: ${failedNameservers.join('; ')}`,
      ];
    }

    // dns-packet decodes the response code (e.g. 'NXDOMAIN') but @types omits it.
    const rcode = (response as { rcode?: string }).rcode;

    if (truncated) {
      trace = [
        ...trace,
        `${recordType} ${domain} @ ${usedNameserver} (udp) -> answer truncated, retry over tcp`,
      ];
    }

    if (response.answers?.length) {
      const filteredAnswers = response.answers.filter(
        (answer) => answer.name === domain && answer.type === recordType,
      ) as RawAnswer[];

      // RRSIGs in the answer that cover the queried type mean this RRset is
      // signed. Works uniformly across NSEC, NSEC3, and synthesized ("black
      // lies") zones, where the NSEC type bitmap would be unreliable.
      const coveringRrsigs = response.answers
        .filter(
          (answer): answer is Extract<Answer, { type: 'RRSIG' }> =>
            answer.type === 'RRSIG' &&
            answer.name === domain &&
            answer.data.typeCovered === recordType,
        )
        .map((sig) => sig.data as RrsigData);

      const fullTrace = [
        ...trace,
        `${recordType} ${domain} @ ${usedNameserver} (${protocol}) -> answer: ${filteredAnswers.map(this.recordToString).join(', ')}`,
      ];

      return {
        answers: filteredAnswers,
        trace: fullTrace,
        rcode,
        coveringRrsigs,
      };
    }

    // We must validate referrals before following them: an attacker controlling
    // a delegated zone can otherwise point our recursive query at loopback or
    // RFC1918 addresses and turn this resolver into an SSRF primitive.
    const redirects = [
      ...(response.authorities || []),
      ...(response.additionals || []),
    ].filter(
      (answer): answer is StringAnswer =>
        answer.type === 'A' || answer.type === 'NS',
    );

    if (redirects.length) {
      // Only trust glue A records that match a delegated NS hostname
      // (in-bailiwick) and resolve to a publicly routable IP address.
      const delegatedNsNames = new Set(
        redirects
          .filter((r) => r.type === 'NS')
          .map((r) => r.data.toLowerCase()),
      );
      const aRedirects = redirects.filter(
        (redirect) =>
          redirect.type === 'A' &&
          delegatedNsNames.has(redirect.name.toLowerCase()) &&
          isPublicIp(redirect.data),
      );
      if (aRedirects.length) {
        // Cap like the sibling NS-resolution/root paths: each candidate costs
        // up to 3 retries x 3s, and the glue set is attacker-influenced.
        const addresses = aRedirects
          .map((redirect) => redirect.data)
          .slice(0, 4);
        const zoneCut = redirects.find((r) => r.type === 'NS')?.name;
        if (zoneCut) this.cacheDelegation(zoneCut, domain, addresses);
        return this.fetchRecordsRaw({
          domain,
          recordType,
          nameservers: addresses,
          trace: [
            ...trace,
            `${recordType} ${domain} @ ${usedNameserver} (${protocol}) -> redirect to ${aRedirects.map((r) => r.data).join(', ')}`,
          ],
          depth: depth + 1,
          dnssecOk,
        });
      }

      const nsRedirects = redirects.filter(
        (redirect) => redirect.type === 'NS',
      );
      if (nsRedirects.length) {
        const aAnswers: RawAnswer[] = [];
        const subTrace: string[] = [];
        for (const ns of nsRedirects.slice(0, 4)) {
          try {
            const resolved = await this.fetchRecordsRaw({
              domain: ns.data,
              recordType: 'A',
              depth: depth + 1,
            });
            aAnswers.push(...resolved.answers);
            subTrace.push(...resolved.trace);
          } catch (error) {
            subTrace.push(
              `A ${ns.data} -> failed: ${
                error instanceof Error ? error.message : 'request failed'
              }`,
            );
          }
        }

        // The resolved NS address is attacker-controlled (they own the zone
        // and can set any A record); filter to public IPs before using it.
        // aAnswers are all A records (filtered by record type), so
        // recordToString yields the bare IP string for each.
        const publicAddresses = aAnswers
          .map((a) => this.recordToString(a))
          .filter((ip) => isPublicIp(ip));
        if (!publicAddresses.length) {
          throw new Error(`Bad redirects for ${domain}`);
        }

        this.cacheDelegation(
          nsRedirects[0].name,
          domain,
          publicAddresses.slice(0, 4),
        );
        return this.fetchRecordsRaw({
          domain,
          recordType,
          nameservers: publicAddresses.slice(0, 4),
          trace: [
            ...trace,
            `${recordType} ${domain} @ ${usedNameserver} (${protocol}) -> redirect to ${nsRedirects.map((r) => r.data).join(', ')}`,
            ...subTrace,
          ],
          depth: depth + 1,
          dnssecOk,
        });
      }

      throw new Error(`Bad redirects for ${domain}`);
    }

    return { answers: [], trace, rcode };
  }

  public async resolveRecordType(
    domain: string,
    recordType: RecordType,
  ): Promise<ResolverResponse> {
    const { answers, trace } = await this.fetchRecordsRaw({
      domain,
      recordType,
    });

    const records: RawRecord[] = answers.map((answer) => ({
      name: answer.name,
      type: answer.type,
      TTL: 'ttl' in answer ? answer.ttl || 0 : 0,
      data: this.recordToString(answer),
    }));

    return { records, trace };
  }

  /**
   * Probe the queried name for common positive RRsets and validate each RRset's
   * covering RRSIG against the already-authenticated DNSKEYs of the signing
   * zone. Negative answers are only recorded as absent; NSEC/NSEC3 denial
   * proofs are a separate validation layer.
   */
  private async probeLeafRrsets(
    name: string,
    signerName: string,
    zoneKeys: DnskeyData[],
    authenticatedKeys: DnssecKey[],
  ): Promise<{ rrsets: DnssecRrset[]; expiresAt?: number }> {
    // Once the DNSKEY RRset has been authenticated by the chain, any key in that
    // validated key set may sign positive data RRsets. Most zones use a ZSK for
    // data, while only the KSK is directly DS-linked.
    const authenticatedKeyIds = new Set(
      authenticatedKeys.map((key) => signerId(key.algorithm, key.keyTag)),
    );

    const results = await Promise.all(
      AuthoritativeResolver.RRSET_PROBE_TYPES.map((type) =>
        this.fetchRecordsRaw({ domain: name, recordType: type, dnssecOk: true })
          .then(({ answers, coveringRrsigs }) =>
            validatePositiveRrset({
              type,
              ownerName: name,
              records: answers,
              rrsigs: coveringRrsigs ?? [],
              keys: zoneKeys,
              authenticatedKeyIds,
              signerName,
            }),
          )
          .catch(
            (): DnssecRrset => ({
              type,
              status: 'indeterminate',
              reason: 'lookup-failed',
              recordCount: 0,
            }),
          ),
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
   * Resolve the DNSSEC authentication chain from the root down to the domain's
   * registered (base) zone. For each zone we fetch its DNSKEYs and the DS the
   * parent publishes for it, then hand the raw records to buildChain() for
   * digest-linkage verification. See lib/dnssec.ts for what is (and isn't)
   * verified. The resolver selector is intentionally bypassed: only an
   * authoritative walk can expose per-zone DNSKEY/DS records.
   *
   * Returns null when the queried domain does not exist (NXDOMAIN), so callers
   * can render a not-found state rather than a misleading "unsigned" verdict.
   */
  public async resolveDnssecChain(domain: string): Promise<DnssecChain | null> {
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

    const rawZones: RawZone[] = [];
    for (const name of zoneNames) {
      const isRoot = name === '.';

      // Failures (timeouts, blocked UDP, bad referrals) must propagate to the
      // error boundary -- they are NOT an unsigned zone, which comes back as an
      // empty (non-throwing) answer set. Swallowing them would render a
      // confident but false "insecure".
      const [keyResult, dsResult] = await Promise.all([
        // DO bit set so the DNSKEY RRset's covering RRSIGs come back -- we
        // cryptographically verify the key set is validly signed, not just
        // digest-linked. See lib/dnssec.ts.
        this.fetchRecordsRaw({
          domain: name,
          recordType: 'DNSKEY',
          dnssecOk: true,
        }),
        isRoot
          ? Promise.resolve({
              answers: [] as RawAnswer[],
              trace: [],
              rcode: undefined as string | undefined,
            })
          : this.fetchRecordsRaw({ domain: name, recordType: 'DS' }),
      ]);

      // An NXDOMAIN on the queried name itself (the leaf) means it does not
      // exist -- treat it as not-found rather than an unsigned delegation. This
      // covers both a nonexistent registered domain and a nonexistent subdomain
      // under an existing one.
      if (
        name === fqdn &&
        (keyResult.rcode === 'NXDOMAIN' || dsResult.rcode === 'NXDOMAIN')
      ) {
        return null;
      }

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
      // in lib/dnssec.ts.)
      if (isRoot || name === base || keys.length || dsRecords.length) {
        rawZones.push({
          name,
          keys,
          dsRecords,
          keyRrsigs: keyResult.coveringRrsigs,
        });
      }
    }

    // The signed root zone always serves DNSKEY records. Getting none back means
    // our path to authoritative DNS is compromised -- typically a network that
    // intercepts port 53 and answers queries itself with empty NODATA responses.
    // Any verdict built on that is false (it would render a bogus-looking
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

    const chain = buildChain(rawZones);

    // Enrich the leaf with positive RRset validation results (the "what's
    // protected" list shown on the chain's bottom card). This is only meaningful
    // when the key chain validates to the signing zone.
    const leaf = chain.zones.at(-1);
    const leafRaw = leaf
      ? rawZones.find((zone) => zone.name === leaf.name)
      : null;
    if (leaf && leafRaw && leaf.status === 'secure') {
      const { rrsets, expiresAt } = await this.probeLeafRrsets(
        probeName,
        leaf.name,
        leafRaw.keys,
        leaf.keys,
      );
      leaf.rrsets = rrsets;
      leaf.signatureExpiresAt = expiresAt;
    }

    return chain;
  }
}
