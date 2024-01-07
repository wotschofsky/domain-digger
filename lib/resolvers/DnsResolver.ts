export const RECORD_TYPES = [
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

export const RECORD_TYPES_BY_DECIMAL = {
  1: 'A',
  28: 'AAAA',
  257: 'CAA',
  5: 'CNAME',
  48: 'DNSKEY',
  43: 'DS',
  15: 'MX',
  35: 'NAPTR',
  2: 'NS',
  12: 'PTR',
  6: 'SOA',
  33: 'SRV',
  16: 'TXT',
} as const;

export type RecordType = (typeof RECORD_TYPES)[number];

export type RawRecord = {
  name: string;
  type: RecordType;
  TTL: number;
  data: string;
};

export type ResolvedRecords = Record<string, RawRecord[]>;

export default abstract class DnsResolver {
  public abstract resolveRecordType(
    domain: string,
    type: RecordType
  ): Promise<RawRecord[]>;

  public async resolveAllRecords(domain: string): Promise<ResolvedRecords> {
    const results = await Promise.all(
      RECORD_TYPES.map((type) => this.resolveRecordType(domain, type))
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
