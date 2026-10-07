import { z } from 'zod';

import { getBaseDomain, isValidDomain } from './utils';

const VERSION = 'v=FORSALE1;';
const UNSAFE_CHARACTERS =
  /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export type ForSaleListing = {
  prices: string[];
  links: string[];
  texts: string[];
};

export type ForSaleSummary = {
  domain: string;
  listing: ForSaleListing | null;
};

const safeLink = (value: string): string | null => {
  if (
    /[\s\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(
      value,
    )
  )
    return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol))
      return null;
    if (url.username || url.password || (!url.pathname && !url.hostname))
      return null;
    return url.href;
  } catch {
    return null;
  }
};

// Parse decoded TXT RDATA, not DNS presentation strings. A valid version alone
// is a sale signal, even when the optional content is unknown or invalid (§2.1).
export const parseForSaleRecords = (
  records: string[],
): ForSaleListing | null => {
  const listing: ForSaleListing = { prices: [], links: [], texts: [] };
  let found = false;
  for (const record of records) {
    if (!record.startsWith(VERSION)) continue;
    found = true;
    if (new TextEncoder().encode(record).length > 255) continue;
    const content = record.slice(VERSION.length).trimStart();
    const value = content.slice(5);
    if (
      content.startsWith('fval=') &&
      /^[A-Z]+[0-9]+(?:\.[0-9]+)?$/.test(value)
    ) {
      listing.prices.push(value.replace(/^([A-Z]+)/, '$1 '));
    } else if (content.startsWith('furi=')) {
      const link = safeLink(value);
      if (link) listing.links.push(link);
    } else if (content.startsWith('ftxt=')) {
      const text = value.replace(UNSAFE_CHARACTERS, ' ').trim();
      if (text) listing.texts.push(text);
    }
    // fcod is a cooperating party's opaque code, not a URL we can decode.
  }
  return found
    ? {
        prices: [...new Set(listing.prices)],
        links: [...new Set(listing.links)],
        texts: [...new Set(listing.texts)],
      }
    : null;
};

// Google DoH can return plain TXT content or quoted DNS presentation data.
// Decode decimal octet escapes in the latter before UTF-8 interpretation;
// concatenate chunks for robustness (§3.2).
const decodeTxt = (data: string): string | null => {
  if (!data.startsWith('"')) return data;
  const bytes: number[] = [];
  const chunks = /\s*"((?:[^"\\]|\\[\s\S])*)"\s*/gy;
  let position = 0;
  while (position < data.length) {
    const match = chunks.exec(data);
    if (!match) return null;
    const content = match[1];
    for (let i = 0; i < content.length; ) {
      if (content[i] === '\\') {
        const decimal = content.slice(i + 1, i + 4);
        if (/^[0-9]{3}$/.test(decimal)) {
          const octet = Number(decimal);
          if (octet > 255) return null;
          bytes.push(octet);
          i += 4;
          continue;
        }
        i++;
      }
      const character = String.fromCodePoint(content.codePointAt(i)!);
      bytes.push(...new TextEncoder().encode(character));
      i += character.length;
    }
    position = chunks.lastIndex;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      new Uint8Array(bytes),
    );
  } catch {
    return null;
  }
};

const responseSchema = z.object({
  Status: z.number().int(),
  TC: z.boolean().optional(),
  Answer: z
    .array(
      z.object({
        name: z.string(),
        type: z.number().int(),
        TTL: z.number().int().nonnegative(),
        data: z.string().max(4096),
      }),
    )
    .max(256)
    .optional(),
});

export const lookupForSale = async (
  domain: string,
): Promise<{
  summary: ForSaleSummary;
  ttl: number;
}> => {
  if (!isValidDomain(domain)) throw new Error('Invalid domain');
  const baseDomain = getBaseDomain(domain).toLowerCase();
  const url = new URL('https://dns.google/resolve');
  url.searchParams.set('name', `_for-sale.${baseDomain}`);
  url.searchParams.set('type', 'TXT');
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(2500),
    cache: 'no-store',
  });
  if (!response.ok)
    throw new Error(`For-sale DNS lookup failed: HTTP ${response.status}`);
  const result = responseSchema.parse(await response.json());
  if (result.TC || ![0, 3].includes(result.Status)) {
    throw new Error(`For-sale DNS lookup failed: status ${result.Status}`);
  }
  const answers = result.Status === 0 ? (result.Answer ?? []) : [];
  const records = answers
    .filter((answer) => answer.type === 16)
    .map((answer) => decodeTxt(answer.data))
    .filter((record): record is string => record !== null);
  const listing = parseForSaleRecords(records);
  return {
    summary: { domain: baseDomain, listing },
    // Include alias TTLs, cap at one hour, and don't cache negative answers
    // without their SOA-derived negative TTL. Failures are handled by the route.
    ttl:
      listing && answers.length
        ? Math.min(3600, ...answers.map((answer) => answer.TTL))
        : 0,
  };
};
