import dnsPacket, { type Answer, Packet, Question } from 'dns-packet';
import dgram from 'node:dgram';
import dns from 'node:dns/promises';

const RECORD_TYPES = [
  'A',
  'AAAA',
  'CAA',
  'CNAME',
  'DNSKEY',
  'DS',
  'MX',
  'NAPTR',
  'NS',
  'PTR',
  'SOA',
  'SRV',
  'TXT',
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

export type RawRecord = {
  name: string;
  type: RecordType;
  TTL: number;
  data: string;
};

export type ResolvedRecords = Record<string, RawRecord[]>;

class DnsLookup {
  static recordToString(record: Answer): string {
    // TODO Submit upstream PR to fix record types

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
          return record.data;
        }
      case 'CAA':
        return `${record.data.flags} ${record.data.tag} "${record.data.value}"`;
      case 'DNSKEY':
        // @ts-ignore
        return `${record.data.flags} ${
          // @ts-ignore
          record.data.algorithm
          // @ts-ignore
        } ${record.data.key.toString('hex')}`;
      case 'DS':
        // @ts-ignore
        return `${record.data.keyTag} ${record.data.algorithm} ${
          // @ts-ignore
          record.data.digestType
          // @ts-ignore
        } ${record.data.digest.toString('hex')}`;
      case 'MX':
        return `${record.data.preference} ${record.data.exchange}`;
      case 'NAPTR':
        // @ts-ignore
        return `${record.data.order} ${record.data.preference} "${record.data.flags}" "${record.data.services}" "${record.data.regexp}" ${record.data.replacement}`;
      case 'NS':
        return record.data;
      case 'SOA':
        return `${record.data.mname} ${record.data.rname} ${record.data.serial} ${record.data.refresh} ${record.data.retry} ${record.data.expire} ${record.data.minimum}`;
      case 'SRV':
        return `${record.data.priority} ${record.data.weight} ${record.data.port} ${record.data.target}`;
      default:
        return 'Unknown Record Type';
    }
  }

  static async fetchRecords(domain: string, recordType: RecordType) {
    // TODO Reduce duplicate NS lookups

    let nameservers: string[] = [];
    let nsDomain = domain;
    while (true) {
      try {
        nameservers = await dns.resolveNs(nsDomain);
        break;
      } catch (err: any) {
        if (err.code === 'ENODATA') {
          // No NS records found, try the parent domain
          nsDomain = nsDomain.replace(/^[^.]+\./, '');
          if (nsDomain.length === 0) {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    if (recordType === 'DS') {
      // DS records are stored at the parent domain
      nsDomain = nsDomain.replace(/^[^.]+\./, '');
      nameservers = await dns.resolveNs(nsDomain);
    }

    const addresses = await dns.resolve4(nameservers[0]);
    const packetBuffer = dnsPacket.encode({
      type: 'query',
      id: 1,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{ type: recordType, name: domain } as Question],
    });

    const socket = dgram.createSocket('udp4');
    socket.send(packetBuffer, 0, packetBuffer.length, 53, addresses[0]);

    return await new Promise<RawRecord[]>((resolve, reject) => {
      socket.on('message', (message: Buffer) => {
        socket.close();

        const response: Packet = dnsPacket.decode(message);

        if (!response.answers) {
          resolve([]);
          return;
        }

        const filteredAnswers = response.answers.filter(
          (answer) =>
            // @ts-expect-error
            RECORD_TYPES.includes(answer.type) && answer.type === recordType
        ) as Extract<Answer, { type: RecordType }>[];

        const recordData: RawRecord[] =
          filteredAnswers?.map((answer) => ({
            name: answer.name,
            type: answer.type,
            TTL: 'ttl' in answer ? answer.ttl || 0 : 0,
            data: DnsLookup.recordToString(answer),
          })) || [];

        resolve(recordData);
      });
      socket.on('error', reject);
    });
  }

  static async resolveAllRecords(domain: string): Promise<ResolvedRecords> {
    const results = await Promise.all(
      RECORD_TYPES.map((type) => DnsLookup.fetchRecords(domain, type))
    );

    return RECORD_TYPES.reduce(
      (res, type, index) => ({
        ...res,
        [type]: results[index],
      }),
      {} as ResolvedRecords
    );
  }
}

export default DnsLookup;
