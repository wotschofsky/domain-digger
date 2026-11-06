import { BaseDoHResolver, type DoHResolverOptions } from './base-doh';

export class GoogleDoHResolver extends BaseDoHResolver {
  constructor(options: DoHResolverOptions = {}) {
    super('https://dns.google/resolve', 'application/json', options);
  }
}
