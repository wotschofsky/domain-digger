import { env } from '@/env';

import {
  DnsResolver,
  type RecordType,
  type ResolverMultiResponse,
  type ResolverResponse,
} from './base';

export class InternalDoHResolver extends DnsResolver {
  constructor(
    private readonly location: string,
    private readonly resolver: 'alibaba' | 'cloudflare' | 'google',
  ) {
    super();
  }

  private getBaseUrl(location: string) {
    const baseUrl = new URL(
      env.SITE_URL ||
        (env.VERCEL_URL && `https://${env.VERCEL_URL}`) ||
        'http://localhost:3000',
    );
    baseUrl.pathname = `/api/internal/resolve/${location}`;
    return baseUrl;
  }

  private get requestInit() {
    if (!env.INTERNAL_API_SECRET) {
      return {};
    }

    return {
      headers: {
        Authorization: env.INTERNAL_API_SECRET,
      },
    };
  }

  public async resolveRecordType(
    domain: string,
    type: RecordType,
  ): Promise<ResolverResponse> {
    const url = this.getBaseUrl(this.location);
    url.searchParams.set('resolver', this.resolver);
    url.searchParams.set('type', type);
    url.searchParams.set('domain', domain);

    const response = await fetch(url, this.requestInit);
    if (!response.ok)
      throw new Error(
        `Failed to fetch results for ${this.location} from ${url}: ${response.status} ${response.statusText}`,
      );

    const results = (await response.json()) as ResolverMultiResponse;

    return results[type];
  }

  public async resolveRecordTypes(
    domain: string,
    types: readonly RecordType[],
  ): Promise<ResolverMultiResponse> {
    const url = this.getBaseUrl(this.location);
    url.searchParams.set('resolver', this.resolver);
    types.forEach((type) => url.searchParams.append('type', type));
    url.searchParams.set('domain', domain);

    const response = await fetch(url, this.requestInit);
    if (!response.ok)
      throw new Error(
        `Failed to fetch results for ${this.location} from ${url}: ${response.status} ${response.statusText}`,
      );

    const results = (await response.json()) as ResolverMultiResponse;

    return results;
  }
}
