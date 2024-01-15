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

  private getBaseUrl(location: string) {
    const baseUrl = new URL(
      process.env.SITE_URL ||
        (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
        'http://localhost:3000'
    );
    baseUrl.pathname = `/api/internal/resolve/${location}`;
    return baseUrl;
  }

  public async resolveRecordType(
    domain: string,
    type: RecordType
  ): Promise<RawRecord[]> {
    const url = this.getBaseUrl(this.location);
    url.searchParams.set('resolver', this.resolver);
    url.searchParams.set('type', type);
    url.searchParams.set('domain', domain);

    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `Failed to fetch results for ${this.location} from ${url}: ${response.status} ${response.statusText}`
      );

    const results = (await response.json()) as { [key: string]: RawRecord[] };

    return results[type];
  }

  public async resolveAllRecords(domain: string): Promise<ResolvedRecords> {
    const url = this.getBaseUrl(this.location);
    url.searchParams.set('resolver', this.resolver);
    RECORD_TYPES.forEach((type) => url.searchParams.append('type', type));
    url.searchParams.set('domain', domain);

    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        `Failed to fetch results for ${this.location} from ${url}: ${response.status} ${response.statusText}`
      );

    const results = (await response.json()) as { [key: string]: RawRecord[] };

    return results;
  }
}
