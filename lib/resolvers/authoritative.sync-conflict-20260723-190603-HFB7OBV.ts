import dgram from 'node:dgram';
import net from 'node:net';

import DataLoader from 'dataloader';
import dnsPacket, {
  type Answer,
  type DecodedPacket,
  type Packet,
  type Question,
  type StringAnswer,
} from 'dns-packet';

import { retry } from '@/lib/utils';

import { UserFacingError } from '../user-facing-error';
import {
  DnsResolver,
  type RawRecord,
  type RecordType,
  type ResolverResponse,
} from './base';
import { isPublicIp } from './ip-filter';

type RawAnswer = Extract<Answer, { type: RecordType }>;

const canonicalDnsName = (name: string): string =>
  name.replace(/\.$/, '').toLowerCase();

export type DnsResponse = {
  packet: Packet;
  protocol: 'udp' | 'tcp';
  truncated: boolean;
};

export type AuthoritativeRequest = {
  domain: string;
  recordType: RecordType;
  nameserver: string;
};

export type AuthoritativeUdpTransport = (
  request: AuthoritativeRequest,
) => Promise<DecodedPacket>;

export type AuthoritativeTcpTransport = (
  request: AuthoritativeRequest,
) => Promise<Packet>;

export type AuthoritativeResolverOptions = {
  udpTransport?: AuthoritativeUdpTransport;
  tcpTransport?: AuthoritativeTcpTransport;
  rootServers?: () => Promise<string[]>;
  // Time budget for trying fallback nameservers after the first candidate
  // (see fetchRecordsRaw). Injectable for tests.
  fallbackDeadlineMs?: number;
};

export const isMatchingDnsResponse = (
  packet: Packet,
  id: number,
  domain: string,
  recordType: RecordType,
): boolean =>
  packet.type === 'response' &&
  packet.id === id &&
  Boolean(
    packet.questions?.some(
      (question) =>
        question.type === recordType &&
        canonicalDnsName(question.name) === canonicalDnsName(domain),
    ),
  );

type FetchRecordsParams = {
  domain: string;
  recordType: RecordType;
  nameserver?: string;
  nameservers?: string[];
  trace?: string[];
  depth?: number;
};

export class AuthoritativeResolver extends DnsResolver {
  private static readonly MAX_RECURSION_DEPTH = 20;
  // Must exceed one candidate's full retry budget (4 attempts x 3s = ~12s):
  // a single blackholed first server has to leave room to reach a healthy
  // fallback, while all-blackholed candidates stay bounded (~2 budgets).
  private static readonly FALLBACK_DEADLINE_MS = 15_000;

  public constructor(
    private readonly options: AuthoritativeResolverOptions = {},
  ) {
    super();
  }

  // One fetch+parse of the root hints per resolver instance; the walk calls
  // getRootServers on every recursion step. A failed attempt is not cached.
  private rootServersPromise?: Promise<string[]>;

  private getRootServers(): Promise<string[]> {
    const loadRootServers =
      this.options.rootServers ?? (() => this.fetchRootServers());
    this.rootServersPromise ??= loadRootServers().catch((error) => {
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

  private async sendUdpRequest({
    domain,
    recordType,
    nameserver,
  }: AuthoritativeRequest) {
    const id = Math.floor(Math.random() * 65535);
    const packetBuffer = dnsPacket.encode({
      type: 'query',
      // Randomize ID to avoid response mismatch
      id,
      questions: [{ type: recordType, name: domain } as Question],
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

      socket.on('message', (message: Buffer, remote) => {
        if (remote.address !== nameserver || remote.port !== 53) return;
        let packet: DecodedPacket;
        try {
          packet = dnsPacket.decode(message);
        } catch {
          return;
        }
        if (!isMatchingDnsResponse(packet, id, domain, recordType)) return;
        cleanup();
        resolve(packet);
      });
      socket.on('error', (error) => {
        cleanup();
        reject(error);
      });

      socket.send(packetBuffer, 0, packetBuffer.length, 53, nameserver);
    });
  }

  private async sendTcpRequest({
    domain,
    recordType,
    nameserver,
  }: AuthoritativeRequest) {
    const id = Math.floor(Math.random() * 65535);
    const packetBuffer = dnsPacket.streamEncode({
      type: 'query',
      id,
      questions: [{ type: recordType, name: domain } as Question],
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
            const packet = dnsPacket.streamDecode(buf);
            if (!isMatchingDnsResponse(packet, id, domain, recordType)) {
              cleanup();
              reject(new Error('DNS response did not match the TCP query'));
              return;
            }
            cleanup();
            resolve(packet);
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
    request: AuthoritativeRequest,
  ): Promise<DnsResponse> {
    // DNS queries are first attempted over UDP per convention. However, UDP
    // responses are limited to 512 bytes (RFC 1035). When the answer exceeds
    // that limit the server truncates the response and sets the TC flag,
    // signaling the client to retry over TCP where the full response (up to
    // 64 KB) can be delivered.
    const udpResponse = this.options.udpTransport
      ? await this.options.udpTransport(request)
      : await this.sendUdpRequest(request);
    if (udpResponse.flag_tc) {
      const packet = this.options.tcpTransport
        ? await this.options.tcpTransport(request)
        : await this.sendTcpRequest(request);
      return { packet, protocol: 'tcp', truncated: true };
    }
    return { packet: udpResponse, protocol: 'udp', truncated: false };
  }

  private requestLoader = new DataLoader<
    AuthoritativeRequest,
    DnsResponse,
    string
  >(
    async (keys) =>
      Promise.all(
        keys.map(async (request) => {
          try {
            return await retry(() => this.sendRequest(request), 3);
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
  }: FetchRecordsParams): Promise<{
    answers: RawAnswer[];
    trace: string[];
    rcode?: string;
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
    const errorRcodes: string[] = [];

    // A blackholed network makes every candidate burn its full retry budget
    // (4 attempts x 3s); serializing that across 4 fallback servers would
    // take ~48s. The first candidate always gets its full budget; further
    // ones only start while the shared deadline allows, so fast failures
    // (REFUSED, quick rejects) still reach every server.
    const fallbackDeadlineMs =
      this.options.fallbackDeadlineMs ??
      AuthoritativeResolver.FALLBACK_DEADLINE_MS;
    const fallbackStartedAt = Date.now();

    for (const candidate of candidateNameservers) {
      if (
        failedNameservers.length > 0 &&
        Date.now() - fallbackStartedAt >= fallbackDeadlineMs
      ) {
        failedNameservers.push(
          `${candidate}: skipped, fallback deadline exceeded`,
        );
        break;
      }
      const loaderKey = {
        domain,
        recordType,
        nameserver: candidate,
      };
      try {
        const result = await this.requestLoader.load(loaderKey);
        const resultRcode = result.packet.rcode;
        if (
          resultRcode !== undefined &&
          resultRcode !== 'NOERROR' &&
          resultRcode !== 'NXDOMAIN'
        ) {
          failedNameservers.push(`${candidate}: DNS ${resultRcode}`);
          errorRcodes.push(resultRcode);
          continue;
        }
        // A terminal-looking response (no answers, no referral) that is not
        // authoritative is a lame server, not proof of NODATA/NXDOMAIN
        // (RFC 2308 negative answers come from the AA server). Accepting it
        // would let one misconfigured candidate mask healthy siblings.
        const lame =
          !result.packet.answers?.length &&
          // flag_aa only exists on decoded packets; encode-side Packet lacks it.
          !(result.packet as DecodedPacket).flag_aa &&
          ![
            ...(result.packet.authorities ?? []),
            ...(result.packet.additionals ?? []),
          ].some((record) => record.type === 'NS' || record.type === 'A');
        if (lame) {
          failedNameservers.push(
            `${candidate}: lame response (empty, not authoritative)`,
          );
          continue;
        }
        // The first authoritative terminal response wins, as with standard
        // resolvers: siblings are not polled in case one has "better" data.
        // A stale-but-authoritative server is the zone operator's problem.
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
      // Some authoritatives REFUSE direct RRSIG browsing (e.g. Cloudflare).
      // Tolerate that one definitive policy response for RRSIG queries only,
      // and only when every attempted server returned it. Ordinary lookups,
      // SERVFAIL/FORMERR/NOTIMP, and mixed transport failures remain
      // retryable errors rather than masquerading as an empty RRset.
      const allRefused =
        errorRcodes.length === candidateNameservers.length &&
        errorRcodes.every((rcode) => rcode === 'REFUSED');
      if (allRefused && recordType === 'RRSIG') {
        return {
          answers: [],
          trace: [
            ...trace,
            `${recordType} ${domain} -> all nameservers returned an error: ${failedNameservers.join('; ')}`,
          ],
          rcode: 'REFUSED',
        };
      }
      throw new UserFacingError(
        {
          title: 'Authoritative DNS servers did not answer',
          description:
            'Every available authoritative nameserver failed or returned a retryable DNS error. Please try again shortly.',
          retryable: true,
        },
        {
          cause: new Error(
            `All nameservers failed for ${domain} ${recordType}: ${failedNameservers.join('; ')}`,
          ),
        },
      );
    }

    if (failedNameservers.length) {
      trace = [
        ...trace,
        `${recordType} ${domain} -> skipped failed nameservers: ${failedNameservers.join('; ')}`,
      ];
    }

    const rcode = response.rcode;

    if (truncated) {
      trace = [
        ...trace,
        `${recordType} ${domain} @ ${usedNameserver} (udp) -> answer truncated, retry over tcp`,
      ];
    }

    // Only records owned by the queried name (any type, e.g. a CNAME alias)
    // make this a terminal answer. An answer section carrying nothing but
    // unrelated records (e.g. glue promoted into it by a quirky server) must
    // not read as an authoritative empty answer -- it falls through to the
    // referral handling below instead.
    // Owner names are case-insensitive; zones may echo them in a different
    // case than the query, and a case-mismatched drop here would misreport
    // a signed RRset as unsigned.
    const wantName = domain.toLowerCase();
    if (
      response.answers?.some((answer) => answer.name.toLowerCase() === wantName)
    ) {
      const filteredAnswers = response.answers.filter(
        (answer) =>
          answer.name.toLowerCase() === wantName && answer.type === recordType,
      ) as RawAnswer[];

      const fullTrace = [
        ...trace,
        `${recordType} ${domain} @ ${usedNameserver} (${protocol}) -> answer: ${filteredAnswers.map(this.recordToString).join(', ')}`,
      ];

      return {
        answers: filteredAnswers,
        trace: fullTrace,
        rcode,
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
        });
      }

      const nsRedirects = redirects.filter(
        (redirect) => redirect.type === 'NS',
      );
      if (nsRedirects.length) {
        const subTrace: string[] = [];
        // Resolve the candidate NS hostnames concurrently and proceed with
        // the first usable result: done serially (or awaited jointly), a
        // dead sibling would stall the walk for its full retry/fallback
        // budget even after a usable address had already been found.
        // The resolved NS address is attacker-controlled (they own the zone
        // and can set any A record); filter to public IPs before using it.
        // Every finished lookup pushes its addresses before resolving, so
        // when the race below ends, all siblings that were at least as fast
        // as the winner are already collected as fallbacks.
        const resolvedSets: string[][] = [];
        const lookups = nsRedirects.slice(0, 4).map(async (ns) => {
          try {
            const resolved = await this.fetchRecordsRaw({
              domain: ns.data,
              recordType: 'A',
              depth: depth + 1,
            });
            subTrace.push(...resolved.trace);
            // resolved.answers are all A records (filtered by type), so
            // recordToString yields the bare IP string for each.
            const ips = resolved.answers
              .map((a) => this.recordToString(a))
              .filter((ip) => isPublicIp(ip));
            if (!ips.length) throw new Error(`no public address (${ns.data})`);
            resolvedSets.push(ips);
            return ips;
          } catch (error) {
            subTrace.push(
              `A ${ns.data} -> failed: ${
                error instanceof Error ? error.message : 'request failed'
              }`,
            );
            throw error;
          }
        });
        try {
          // Proceed as soon as any lookup yields a usable address -- a dead
          // sibling must not stall the walk once one is available.
          await Promise.any(lookups);
        } catch {
          throw new Error(`Bad redirects for ${domain}`);
        }
        const publicAddresses = [...new Set(resolvedSets.flat())];

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
}
