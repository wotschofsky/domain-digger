import { CloudflareDoHResolver } from './resolvers/cloudflare';
import { getBaseDomain, isValidDomain } from './utils';

const VERSION = 'v=FORSALE1;';
const MAX_ANSWERS = 256;
const MAX_ANSWER_BYTES = 4096;
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\p{Bidi_Control}]/gu;

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
  if (/[\s\u0000-\u001f\u007f-\u009f\p{Bidi_Control}]/u.test(value))
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
  const saleRecords = records.filter(
    (record) =>
      record.startsWith(VERSION) &&
      new TextEncoder().encode(record).length <= 255,
  );
  if (!saleRecords.length) return null;

  const prices = new Set<string>();
  const links = new Set<string>();
  const texts = new Set<string>();

  for (const record of saleRecords) {
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
// Sale records must contain a single character-string (§2.4).
// Decode decimal octet escapes before interpreting their UTF-8 content.
const decodeTxt = (data: string): string | null => {
  if (!data.startsWith('"')) return data;

  const match = /^"((?:[^"\\]|\\[\s\S])*)"$/u.exec(data);
  if (!match) return null;
  const content = match[1];
  const bytes: number[] = [];
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

  if (bytes.length > 255) return null;

  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      new Uint8Array(bytes),
    );
  } catch {
    // Invalid optional bytes must not hide an otherwise valid sale signal.
    return VERSION.split('').every(
      (character, index) => bytes[index] === character.charCodeAt(0),
    )
      ? VERSION
      : null;
  }
};

export const lookupForSale = async (
  domain: string,
): Promise<ForSaleSummary> => {
  if (!isValidDomain(domain)) throw new Error('Invalid domain');

  const baseDomain = getBaseDomain(domain).toLowerCase();
  if (baseDomain === 'arpa' || baseDomain.endsWith('.arpa'))
    return { domain: baseDomain, listing: null };

  const resolver = new CloudflareDoHResolver({
    signal: AbortSignal.timeout(2500),
  });
  const { answers, rcode } = await resolver.resolveAnswers(
    `_for-sale.${baseDomain}`,
    'TXT',
  );
  if (
    answers.length > MAX_ANSWERS ||
    answers.some(
      ({ data }) =>
        data.length > MAX_ANSWER_BYTES ||
        new TextEncoder().encode(data).length > MAX_ANSWER_BYTES,
    )
  )
    throw new Error('For-sale DNS response exceeds size limits');

  const records = (rcode === 0 ? answers : [])
    .filter((answer) => answer.type === 16)
    .map((answer) => decodeTxt(answer.data))
    .filter((record): record is string => record !== null);
  return { domain: baseDomain, listing: parseForSaleRecords(records) };
};
