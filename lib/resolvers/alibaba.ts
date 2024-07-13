import { BaseDoHResolver } from './base-doh';

export class AlibabaDoHResolver extends BaseDoHResolver {
  constructor() {
    super((domain, type) =>
      fetch(`https://dns.alidns.com/resolve?name=${domain}&type=${type}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
    );
  }
}
