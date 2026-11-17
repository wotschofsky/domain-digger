import { BaseDoHResolver, type DoHResolverOptions } from './base-doh';

export class CloudflareDoHResolver extends BaseDoHResolver {
  constructor(options: DoHResolverOptions = {}) {
    super(
      'https://cloudflare-dns.com/dns-query',
      'application/dns-json',
      options,
    );
  }
}
