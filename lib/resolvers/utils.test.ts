import { describe, expect, it } from 'vitest';

import { AuthoritativeResolver } from './authoritative';
import { CloudflareDoHResolver } from './cloudflare';
import { GoogleDoHResolver } from './google';
import { InternalDoHResolver } from './internal';
import { getResolverFromName } from './utils';

describe('getResolverFromName', () => {
  it('should return an instance of CloudflareDoHResolver when resolver name is "cloudflare" and location is undefined', () => {
    const resolver = getResolverFromName('cloudflare', undefined);
    expect(resolver).toBeInstanceOf(CloudflareDoHResolver);
  });

  it('should return an instance of GoogleDoHResolver when resolver name is "google" and location is undefined', () => {
    const resolver = getResolverFromName('google', undefined);
    expect(resolver).toBeInstanceOf(GoogleDoHResolver);
  });

  it('should return an instance of AuthoritativeResolver when resolver name is not recognized and location is undefined', () => {
    const resolver = getResolverFromName('unknown', undefined);
    expect(resolver).toBeInstanceOf(AuthoritativeResolver);
  });

  it('should return an instance of InternalDoHResolver with type "cloudflare" when resolver name is "cloudflare" and location is defined', () => {
    const resolver = getResolverFromName('cloudflare', 'sfo1');
    expect(resolver).toBeInstanceOf(InternalDoHResolver);
    expect(resolver).toHaveProperty('resolver', 'cloudflare');
    expect(resolver).toHaveProperty('location', 'sfo1');
  });

  it('should return an instance of InternalDoHResolver with type "google" when resolver name is "google" and location is defined', () => {
    const resolver = getResolverFromName('google', 'iad1');
    expect(resolver).toBeInstanceOf(InternalDoHResolver);
    expect(resolver).toHaveProperty('resolver', 'google');
    expect(resolver).toHaveProperty('location', 'iad1');
  });

  it('should throw an error when an invalid resolver name is provided and location is defined', () => {
    expect(() => getResolverFromName('invalid', 'iad1')).toThrow(
      'Invalid resolver',
    );
  });
});
