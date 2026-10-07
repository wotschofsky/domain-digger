import { CloudflareDoHResolver } from './resolvers/cloudflare';
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
  const saleRecords = records.filter((record) => record.startsWith(VERSION));
  if (!saleRecords.length) return null;

  const prices = new Set<string>();
  const links = new Set<string>();
  const texts = new Set<string>();

  for (const record of saleRecords) {
    if (new TextEncoder().encode(record).length > 255) continue;

    const content = record.slice(VERSION.length).trimStart();
    const separator = content.indexOf('=');
    if (separator === -1) continue;

    const tag = content.slice(0, separator);
    const value = content.slice(separator + 1);

    if (tag === 'fval' && /^[A-Z]+[0-9]+(?:\.[0-9]+)?$/.test(value)) {
      prices.add(value.replace(/^([A-Z]+)/, '$1 '));
    } else if (tag === 'furi') {
      const link = safeLink(value);
      if (link) links.add(link);
    } else if (tag === 'ftxt') {
      const text = value.replace(UNSAFE_CHARACTERS, ' ').trim();
      if (text) texts.add(text);
    }
    // fcod is a cooperating party's opaque code, not a URL we can decode.
  }
  return { prices: [...prices], links: [...links], texts: [...texts] };
};

// Accept plain TXT content or quoted DNS presentation data from DoH resolvers.
// Decode decimal octet escapes in the latter before UTF-8 interpretation;
// concatenate chunks for robustness (§3.2).
const decodeTxt = (data: string): string | null => {
  if (!data.startsWith('"')) return data;

  const bytes: number[] = [];
  const chunks = /\s*"((?:[^"\\]|\\[\s\S])*)"\s*/gy;
  while (chunks.lastIndex < data.length) {
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
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      new Uint8Array(bytes),
    );
  } catch {
    return null;
  }
};

export const lookupForSale = async (
  domain: string,
): Promise<{
  summary: ForSaleSummary;
  ttl: number;
}> => {
  if (!isValidDomain(domain)) throw new Error('Invalid domain');

  const baseDomain = getBaseDomain(domain).toLowerCase();
  const resolver = new CloudflareDoHResolver({
    signal: AbortSignal.timeout(2500),
    cache: 'no-store',
  });
  const { answers, rcode } = await resolver.resolveAnswers(
    `_for-sale.${baseDomain}`,
    'TXT',
  );
  const records = (rcode === 0 ? answers : [])
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
