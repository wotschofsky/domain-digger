import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parse as tldtsParse } from 'tldts';

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

export const isAppleDevice = () => {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent;
  return /Mac|iPad|iPhone|iPod/.test(userAgent);
};
