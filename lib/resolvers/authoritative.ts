import dgram from 'node:dgram';
import net from 'node:net';

import DataLoader from 'dataloader';
import dnsPacket, {
  type Answer,
  type Packet,
  type Question,
  type StringAnswer,
} from 'dns-packet';

import { retry } from '@/lib/utils';

import {
  DnsResolver,
  type RawRecord,
  type RecordType,
  type ResolverResponse,
} from './base';

type DnsResponse = { packet: Packet; protocol: 'udp' | 'tcp' };

export class AuthoritativeResolver extends DnsResolver {
  private async getRootServers() {
    const response = await fetch('https://www.internic.net/domain/named.root', {
      next: {
        revalidate: 7 * 24 * 60 * 60,
      },
    });
    const body = await response.text();

    // TODO Support IPv6
    const aRecords = body.match(/\sA\s+(.+)/g);

    if (!aRecords) {
      throw new Error('Failed to fetch root servers');
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
  ) {
    const packetBuffer = dnsPacket.encode({
      type: 'query',
      id: 1,
      questions: [{ type: recordType, name: domain } as Question],
    });

    const socket = dgram.createSocket('udp4');
    socket.send(packetBuffer, 0, packetBuffer.length, 53, nameserver);

    return await new Promise<Packet>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.close();
        reject(
          new Error(
            `Request to ${nameserver} for domain ${domain}, type ${recordType} timed out after 3000ms`,
          ),
        );
      }, 3000);

      socket.on('message', (message: Buffer) => {
        socket.close();

        const response: Packet = dnsPacket.decode(message);

        clearTimeout(timeout);
        resolve(response);
      });
      socket.on('error', (error) => {
        socket.close();
        reject(error);
      });
    });
  }

  private async sendTcpRequest(
    domain: string,
    recordType: RecordType,
    nameserver: string,
  ) {
    const packetBuffer = dnsPacket.streamEncode({
      type: 'query',
      id: 1,
      questions: [{ type: recordType, name: domain } as Question],
    });

    return await new Promise<Packet>((resolve, reject) => {
      const socket = net.createConnection(53, nameserver, () => {
        socket.write(packetBuffer);
      });

      const timeout = setTimeout(() => {
        socket.destroy();
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
            socket.destroy();
            clearTimeout(timeout);
            resolve(dnsPacket.streamDecode(buf));
          }
        }
      });
      socket.on('error', (error) => {
        clearTimeout(timeout);
        socket.destroy();
        reject(error);
      });
    });
  }

  private async sendRequest(
    domain: string,
    recordType: RecordType,
    nameserver: string,
  ) {
    // DNS queries are first attempted over UDP per convention. However, UDP
    // responses are limited to 512 bytes (RFC 1035). When the answer exceeds
    // that limit the server truncates the response and sets the TC flag,
    // signaling the client to retry over TCP where the full response (up to
    // 64 KB) can be delivered.
    const udpResponse = await this.sendUdpRequest(domain, recordType, nameserver);
    if ((udpResponse as Packet & { flag_tc?: boolean }).flag_tc) {
      const packet = await this.sendTcpRequest(domain, recordType, nameserver);
      return { packet, protocol: 'tcp' };
    }
    return { packet: udpResponse, protocol: 'udp' };
  }

  private requestLoader = new DataLoader<
    {
      domain: string;
      type: RecordType;
      nameserver: string;
    },
    DnsResponse,
    string
  >(
    async (keys) =>
      Promise.all(
        keys.map(async ({ domain, type, nameserver }) =>
          retry(() => this.sendRequest(domain, type, nameserver), 3),
        ),
      ),
    {
      cacheKeyFn: (key) => JSON.stringify(key),
    },
  );

  private async fetchRecords(
    domain: string,
    recordType: RecordType,
    nameserver?: string,
    trace: string[] = [],
  ): Promise<ResolverResponse> {
    const rootServers = await this.getRootServers();

    const usedNameserver = nameserver || rootServers[0]; // TODO Use fallback nameservers
    const { packet: response, protocol } = await this.requestLoader.load({
      domain,
      type: recordType,
      nameserver: usedNameserver,
    });

    if (response.answers?.length) {
      const filteredAnswers = response.answers.filter(
        (answer) => answer.name === domain && answer.type === recordType,
      ) as Extract<Answer, { type: RecordType }>[];

      const records: RawRecord[] =
        filteredAnswers?.map((answer) => ({
          name: answer.name,
          type: answer.type,
          TTL: 'ttl' in answer ? answer.ttl || 0 : 0,
          data: this.recordToString(answer),
        })) || [];

      const fullTrace = [
        ...trace,
        `${recordType} ${domain} @ ${usedNameserver} (${protocol}) -> answer: ${filteredAnswers.map(this.recordToString).join(', ')}`,
      ];

      return { records, trace: fullTrace };
    }

    // TODO Support IPv6
    const redirects = Object.assign(
      [] as Answer[],
      response.authorities,
      response.additionals,
    ).filter((answer) => answer.type === 'A' || answer.type === 'NS');

    if (redirects.length) {
      const aRedirects = redirects.filter(
        (redirect) => redirect.type === 'A',
      ) as StringAnswer[];
      if (aRedirects.length) {
        return this.fetchRecords(domain, recordType, aRedirects[0].data, [
          ...trace,
          `${recordType} ${domain} @ ${usedNameserver} (${protocol}) -> redirect to ${aRedirects.map((r) => r.data).join(', ')}`,
        ]);
      }

      const nsRedirects = redirects.filter(
        (redirect) => redirect.type === 'NS',
      ) as StringAnswer[];
      if (nsRedirects.length) {
        const { records: aRecords, trace: subTrace } = await this.fetchRecords(
          nsRedirects[0].data,
          'A',
        );

        if (!aRecords.length) {
          throw new Error(`Bad redirects for ${domain}`);
        }

        return this.fetchRecords(domain, recordType, aRecords[0].data, [
          ...trace,
          `${recordType} ${domain} @ ${usedNameserver} (${protocol}) -> redirect to ${nsRedirects.map((r) => r.data).join(', ')}`,
          ...subTrace,
        ]);
      }

      throw new Error(`Bad redirects for ${domain}`);
    }

    return { records: [], trace };
  }

  public async resolveRecordType(
    domain: string,
    type: RecordType,
  ): Promise<ResolverResponse> {
    return this.fetchRecords(domain, type);
  }
}
