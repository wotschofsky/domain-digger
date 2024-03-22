import { BaseDoHResolver } from './base-doh';

export class GoogleDoHResolver extends BaseDoHResolver {
  constructor() {
    super((domain, type) =>
      fetch(`https://dns.google/resolve?name=${domain}&type=${type}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
    );
  }
}
