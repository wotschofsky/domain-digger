import { toASCII } from 'punycode';

import { IPV4_REGEX, IPV6_REGEX, isValidDomain } from './utils';

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
  | { type: 'invalid' };

export const parseSearchInput = (input: string): SearchResult => {
  const trimmedInput = input.trim();
  if (trimmedInput.length === 0) {
    return {
      type: 'empty',
    } as const;
  }

  if (trimmedInput.match(IPV4_REGEX) || trimmedInput.match(IPV6_REGEX)) {
    return {
      type: 'ip',
      value: trimmedInput,
    } as const;
  }

  const normalizedDomain = normalizeDomain(trimmedInput);
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
