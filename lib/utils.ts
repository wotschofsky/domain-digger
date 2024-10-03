import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getDomain, parse as tldtsParse } from 'tldts';

export const DOMAIN_REGEX = /([a-zA-Z0-9-_]+\.)+[a-z]+\.?/gi;
const DOMAIN_LABEL_REGEX =
  /^(xn--)?[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
export const IPV4_REGEX =
  /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g;
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

// ABased on https://en.wikipedia.org/wiki/Domain_name#Domain_name_syntax
export const isValidDomain = (domain: string) => {
  if (typeof domain !== 'string') {
    if (process?.env.VITEST !== 'true') {
      console.warn('isValidDomain expects a string input, received', domain);
    }
    return false;
  }

  // Check total length (maximum 253 characters)
  if (domain.length > 253 || domain.length === 0) return false;

  // Remove wildcard prefix & trailing dot (if fully qualified domain name)
  const cleanedDomain = domain.replace(/^\*\./, '').replace(/\.$/, '');

  // Split domain into labels
  const labels = cleanedDomain.split('.');

  for (const label of labels) {
    // Check label length (between 1 and 63 characters)
    if (label.length < 1 || label.length > 63) {
      return false;
    }

    // Check if label matches the regular expression
    if (!DOMAIN_LABEL_REGEX.test(label)) {
      return false;
    }
  }

  try {
    const result = tldtsParse(cleanedDomain);
    return Boolean(result.isIcann || result.isPrivate);
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
