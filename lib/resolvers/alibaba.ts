import { BaseDoHResolver, type DoHResolverOptions } from './base-doh';

export class AlibabaDoHResolver extends BaseDoHResolver {
  constructor(options: DoHResolverOptions = {}) {
    super('https://dns.alidns.com/resolve', 'application/json', options);
  }
}
