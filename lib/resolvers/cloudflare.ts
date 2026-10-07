import { BaseDoHResolver } from './base-doh';

export class CloudflareDoHResolver extends BaseDoHResolver {
  constructor(options: Pick<RequestInit, 'cache' | 'signal'> = {}) {
    super((domain, type) => {
      const url = new URL('https://cloudflare-dns.com/dns-query');
      url.searchParams.set('name', domain);
      url.searchParams.set('type', type);

      return fetch(url, {
        ...options,
        method: 'GET',
        headers: { Accept: 'application/dns-json' },
      });
    });
  }
}
