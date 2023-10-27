import Bottleneck from 'bottleneck';
import DataLoader from 'dataloader';
import dnsPacket, {
  type Answer,
  type Packet,
  type Question,
  type StringAnswer,
} from 'dns-packet';
import dgram from 'node:dgram';

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
      (l) => l.replaceAll(/\s+/g, ' ').split(' ')[2]
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
          return record.data;
        }
      case 'CAA':
        return `${record.data.flags} ${record.data.tag} "${record.data.value}"`;
      case 'DNSKEY':
        return `${record.data.flags} ${
          record.data.algorithm
        } ${record.data.key.toString('hex')}`;
      case 'DS':
        return `${record.data.keyTag} ${record.data.algorithm} ${
          record.data.digestType
        } ${record.data.digest.toString('hex')}`;
      case 'MX':
        return `${record.data.preference} ${record.data.exchange}`;
      case 'NAPTR':
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

  private async sendRequest(
    domain: string,
    recordType: RecordType,
    nameserver: string
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
            `Request to ${nameserver} for domain ${domain}, type ${recordType} timed out`
          )
        );
      }, 4000);

      socket.on('message', (message: Buffer) => {
        socket.close();

        const response: Packet = dnsPacket.decode(message);

        clearTimeout(timeout);
        resolve(response);
      });
      socket.on('error', reject);
    });
  }

  private limiter = new Bottleneck({
    maxConcurrent: 10,
    minTime: 160,
  });

  private requestLoader = new DataLoader<
    {
      domain: string;
      type: RecordType;
      nameserver: string;
    },
    Packet,
    string
  >(
    async (keys) =>
      Promise.all(
        keys.map(async ({ domain, type, nameserver }) =>
          this.limiter.schedule(() =>
            this.sendRequest(domain, type, nameserver)
          )
        )
      ),
    {
      cacheKeyFn: (key) => JSON.stringify(key),
    }
  );

  private async fetchRecords(
    domain: string,
    recordType: RecordType,
    nameserver?: string
  ): Promise<RawRecord[]> {
    const rootServers = await this.getRootServers();

    const response = await this.requestLoader.load({
      domain,
      type: recordType,
      nameserver: nameserver || rootServers[0], // TODO Use fallback nameservers
    });

    if (response.answers?.length) {
      const filteredAnswers = response.answers.filter(
        (answer) => answer.name === domain && answer.type === recordType
      ) as Extract<Answer, { type: RecordType }>[];

      const recordData: RawRecord[] =
        filteredAnswers?.map((answer) => ({
          name: answer.name,
          type: answer.type,
          TTL: 'ttl' in answer ? answer.ttl || 0 : 0,
          data: this.recordToString(answer),
        })) || [];

      return recordData;
    }

    // TODO Support IPv6
    const redirects = Object.assign(
      [] as Answer[],
      response.authorities,
      response.additionals
    ).filter((answer) => answer.type === 'A' || answer.type === 'NS');

    if (redirects.length) {
      const ipValue = (
        redirects.find((redirect) => redirect.type === 'A') as
          | StringAnswer
          | undefined
      )?.data;
      if (ipValue) {
        return this.fetchRecords(domain, recordType, ipValue);
      }

      const nsValue = (
        redirects.find((redirect) => redirect.type === 'NS') as
          | StringAnswer
          | undefined
      )?.data;
      if (!nsValue) {
        throw new Error(`Bad redirects for ${domain}`);
      }

      const records = await this.fetchRecords(nsValue, 'A');

      if (!records.length) {
        throw new Error(`Bad redirects for ${domain}`);
      }

      return this.fetchRecords(domain, recordType, records[0].data);
    }

    return [];
  }

  public async resolveAllRecords(domain: string): Promise<ResolvedRecords> {
    const results = await Promise.all(
      RECORD_TYPES.map((type) => this.fetchRecords(domain, type))
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
