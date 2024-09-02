import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getDomain, parse as tldtsParse } from 'tldts';

export const DOMAIN_REGEX = /([a-zA-Z0-9-_]+\.)+[a-z]+\.?/gi;
export const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/g;
export const IPV6_REGEX =
  /((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?/gi;

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const deduplicate = <T>(array: T[]): T[] => Array.from(new Set(array));

// From https://stackoverflow.com/a/30471209/12475254
export const retry = <T extends Function>(fn: T, maxRetries: number) =>
  fn().catch((err: Error) => {
    if (maxRetries <= 0) {
      throw err;
    }
    console.warn(err.message?.toString());
    return retry(fn, maxRetries - 1);
  });

export const isValidDomain = (domain: string) => {
  if (typeof domain !== 'string') {
    if (process?.env.VITEST !== 'true') {
      console.warn('isValidDomain expects a string input, received', domain);
    }
    return false;
  }

  // TODO Integrate hyphen check into regex
  const regexResult =
    /^(\*\.)?(((?!-))(xn--|_)?[a-z0-9-]{0,61}[a-z0-9]{1,1}\.)*(xn--)?([a-z0-9][a-z0-9\-]{0,60}|[a-z0-9-]{1,30}\.[a-z]{2,})$/.test(
      domain
    ) && !domain.startsWith('-');
  if (!regexResult) return false;

  // Remove wildcard prefix to avoid false negatives from library
  const cleanedDomain = domain.replace(/^\*\./, '');
  try {
    const result = tldtsParse(cleanedDomain);
    return result.isIcann || result.isPrivate;
  } catch (error) {
    return false;
  }
};

/**
 * Extracts the base domain from a given domain
 *
 * Example: www.example.com -> example.com
 */
export const getBaseDomain = (domain: string) => {
  // Remove wildcard prefix to avoid base domain not being extracted correctly
  // Remove trailing dot
  const cleanedDomain = domain.replace(/^\*\./, '').replace(/\.$/, '');
  const baseDomain = getDomain(cleanedDomain) || cleanedDomain;
  return baseDomain;
};

export const isWildcardDomain = (domain: string) =>
  domain.startsWith('*.') && domain.length > 2;

export const isAppleDevice = () => {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent;
  return /Mac|iPad|iPhone|iPod/.test(userAgent);
};
