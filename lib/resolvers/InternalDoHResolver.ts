import DnsResolver, {
  type RawRecord,
  RECORD_TYPES,
  type RecordType,
  type ResolvedRecords,
} from './DnsResolver';

type DoHResponse = {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: {
    name: string;
    type: number;
  }[];
  Answer?: {
    name: string;
    type: number;
    TTL: number;
    data: string;
  }[];
  Authority?: {
    name: string;
    type: number;
    TTL: number;
    data: string;
  }[];
};

export default class InternalDoHResolver extends DnsResolver {
  constructor(
    private readonly location: string,
    private readonly resolver: 'cloudflare' | 'google'
  ) {
    super();
  }

  public async resolveRecordType(
    domain: string,
    type: RecordType
  ): Promise<RawRecord[]> {
    const url = `${
      process.env.SITE_URL ||
      (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
      'http://localhost:3000'
    }/api/internal/resolve/${this.location}?resolver=${
      this.resolver
    }&type=${type}&domain=${encodeURIComponent(domain)}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `Failed to fetch results for ${this.location} from ${url}: ${response.status} ${response.statusText}`
      );

    const results = (await response.json()) as { [key: string]: RawRecord[] };

    return results[type];
  }

  public async resolveAllRecords(domain: string): Promise<ResolvedRecords> {
    const typesParam = RECORD_TYPES.map((type) => `type=${type}`).join('&');
    const url = `${
      process.env.SITE_URL ||
      (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
      'http://localhost:3000'
    }/api/internal/resolve/${this.location}?resolver=${
      this.resolver
    }&${typesParam}&domain=${encodeURIComponent(domain)}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `Failed to fetch results for ${this.location} from ${url}: ${response.status} ${response.statusText}`
      );

    const results = (await response.json()) as { [key: string]: RawRecord[] };

    return results;
  }
}
