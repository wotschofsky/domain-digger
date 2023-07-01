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
  type: number;
  TTL: number;
  data: string;
};

export type ResolvedRecords = {
  [name: string]: RawRecord[];
};

const trimPeriods = (input: string) => input.replace(/^\.+|\.+$/g, '');

class DnsLookup {
  static async fetchRecords(
    domain: string,
    record: RecordType
  ): Promise<RawRecord[]> {
    const url = `https://dns.google.com/resolve?name=${domain}&type=${record}`;

    const response = await fetch(url);
    const data = (await response.json()) as Record<string, any>;
    const records = data.Answer || [];

    return records;
  }

  // Filter records to prevent results from recursive CNAME lookups showing up
  static filterRecords(domain: string, records: RawRecord[]): RawRecord[] {
    const trimmedDomain = trimPeriods(domain);
    return records.filter(
      (record) => trimPeriods(record.name) === trimmedDomain
    );
  }

  static async resolveAllRecords(domain: string): Promise<ResolvedRecords> {
    const results = await Promise.allSettled(
      RECORD_TYPES.map((type) => DnsLookup.fetchRecords(domain, type))
    );

    return RECORD_TYPES.reduce((res, type, index) => {
      const result = results[index];
      res[type] = DnsLookup.filterRecords(
        domain,
        result.status === 'fulfilled' ? result.value : []
      );
      return res;
    }, {} as ResolvedRecords);
  }
}

export default DnsLookup;
