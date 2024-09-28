import { AlibabaDoHResolver } from './alibaba';
import { AuthoritativeResolver } from './authoritative';
import { CloudflareDoHResolver } from './cloudflare';
import { GoogleDoHResolver } from './google';
import { InternalDoHResolver } from './internal';

export const getResolverFromName = (
  resolverName: string | undefined,
  locationName: string | undefined,
) => {
  if (locationName) {
    switch (resolverName) {
      case 'cloudflare':
        return new InternalDoHResolver(locationName, 'cloudflare');
      case 'google':
        return new InternalDoHResolver(locationName, 'google');
      case 'alibaba':
        return new InternalDoHResolver(locationName, 'alibaba');
    }

    throw new Error('Invalid resolver');
  }

  switch (resolverName) {
    case 'cloudflare':
      return new CloudflareDoHResolver();
    case 'google':
      return new GoogleDoHResolver();
    case 'alibaba':
      return new AlibabaDoHResolver();
    default:
      return new AuthoritativeResolver();
  }
};
