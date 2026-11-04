import { toASCII } from 'punycode';
import isIP from 'validator/lib/isIP';

import { isValidDomain } from './utils';

export const normalizeDomain = (input: string): string => {
  let tDomain;
  try {
    tDomain = new URL(input.trim().toLowerCase()).hostname;
  } catch (err) {
    tDomain = input.trim().toLowerCase();
  }

  const normalizedDomain = tDomain.endsWith('.')
    ? tDomain.slice(0, -1)
    : tDomain;
  return toASCII(normalizedDomain);
};

export type SearchResult =
  | { type: 'empty' }
  | { type: 'ip'; value: string }
  | { type: 'domain'; value: string }
  | { type: 'invalid'; reason?: 'scoped-ip' };

export const parseSearchInput = (input: string): SearchResult => {
  const trimmedInput = input.trim();
  if (trimmedInput.length === 0) {
    return {
      type: 'empty',
    } as const;
  }

  // Whole input only: the shared IP regexes find IPs inside text, such as a URL's query.
  if (isIP(trimmedInput)) {
    // An interface such as %lo0 refers to the browser's device, not this server.
    if (trimmedInput.includes('%'))
      return { type: 'invalid', reason: 'scoped-ip' };

    return {
      type: 'ip',
      value: trimmedInput,
    } as const;
  }

  const normalizedDomain = normalizeDomain(trimmedInput);
  const host = normalizedDomain.replace(/^\[|\]$/g, '');

  if (isIP(host))
    return host.includes('%')
      ? { type: 'invalid', reason: 'scoped-ip' }
      : { type: 'ip', value: host };

  if (isValidDomain(normalizedDomain)) {
    return {
      type: 'domain',
      value: normalizedDomain,
    } as const;
  }

  if (trimmedInput.includes('@')) {
    const result = parseSearchInput(trimmedInput.split('@').pop()!);
    if (result.type === 'empty') {
      return {
        type: 'invalid',
      } as const;
    }
    return result;
  }

  return {
    type: 'invalid',
  } as const;
};
