import BaseDoHResolver from './BaseDoHResolver';

export default class CloudflareDoHResolver extends BaseDoHResolver {
  constructor() {
    super((domain, type) =>
      fetch(
        `https://cloudflare-dns.com/dns-query?name=${domain}&type=${type}`,
        {
          method: 'GET',
          headers: { Accept: 'application/dns-json' },
        }
      )
    );
  }
}
