import { canonicalDnsName } from './resolvers/base';
import { CloudflareDoHResolver } from './resolvers/cloudflare';
import { getBaseDomain, isValidDomain } from './utils';

const VERSION = 'v=FORSALE1;';
const MAX_ANSWERS = 256;
const MAX_ANSWER_BYTES = 4096;
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\p{Bidi_Control}]/gu;
// The schemes RFC 10023 recommends (§2.2.3), most preferred first (§4).
const LINK_SCHEMES = ['https:', 'http:', 'mailto:', 'tel:'];
// A dotted DNS name as the URL parser serializes it: no IP address, no
// single-label or wildcard host.
const HOSTNAME =
  /^(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?\.?$/;

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
    if (!LINK_SCHEMES.includes(url.protocol)) return null;
    if (url.username || url.password || (!url.pathname && !url.hostname))
      return null;
    // "https://a.example;http://b.example" parses as one URL with a bogus host.
    if (url.protocol.startsWith('http') && !HOSTNAME.test(url.hostname))
      return null;
    return url.href;
  } catch {
    return null;
  }
};

const compare = (a: string | number, b: string | number) =>
  a < b ? -1 : a > b ? 1 : 0;

// DNS returns an RRset in no particular order, so details are sorted to show
// the same listing on every lookup: prices by currency, then amount.
const comparePrices = (a: string, b: string) => {
  const [currencyA, amountA] = a.split(' ');
  const [currencyB, amountB] = b.split(' ');
  return (
    compare(currencyA, currencyB) ||
    compare(Number(amountA), Number(amountB)) ||
    compare(a, b)
  );
};

const compareLinks = (a: string, b: string) => {
  const preference = (link: string) =>
    LINK_SCHEMES.findIndex((scheme) => link.startsWith(scheme));
  return compare(preference(a), preference(b)) || compare(a, b);
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
    // Content past the 255 octets of one character-string is invalid (§2.4).
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
  return {
    prices: [...prices].sort(comparePrices),
    links: [...links].sort(compareLinks),
    texts: [...texts].sort(compare),
  };
};

// Accept plain TXT content or quoted DNS presentation data from DoH resolvers.
// Decode decimal octet escapes and join multiple character-strings before
// interpreting the octets as UTF-8 (§3.2).
const decodeTxt = (data: string): string | null => {
  if (!data.startsWith('"')) return data;

  const strings = [...data.matchAll(/"((?:[^"\\]|\\[\s\S])*)"(?: |$)/guy)];
  if (strings.map(([string]) => string).join('') !== data) return null;

  const bytes: number[] = [];
  for (const [, content] of strings) {
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

const lookupListing = async (
  resolver: CloudflareDoHResolver,
  name: string,
): Promise<ForSaleListing | null> => {
  const { answers, rcode } = await resolver.resolveAnswers(
    `_for-sale.${name}`,
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
  return parseForSaleRecords(records);
};

export const lookupForSale = async (
  domain: string,
): Promise<ForSaleSummary> => {
  if (!isValidDomain(domain)) throw new Error('Invalid domain');

  const baseDomain = getBaseDomain(domain).toLowerCase();
  if (baseDomain === 'arpa' || baseDomain.endsWith('.arpa'))
    return { domain: baseDomain, listing: null };

  // The leaf may sit at any level of the DNS (§2.6), so a record on the
  // searched name comes first. Its registrable domain is the fallback, so a
  // host such as www still shows that the domain it belongs to is for sale.
  const name = canonicalDnsName(domain).replace(/^\*\./, '');
  const names = [...new Set([name, baseDomain])];

  const resolver = new CloudflareDoHResolver({
    signal: AbortSignal.timeout(2500),
  });
  const results = await Promise.allSettled(
    names.map((candidate) => lookupListing(resolver, candidate)),
  );
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled' && result.value)
      return { domain: names[index], listing: result.value };
  }
  // No listing anywhere: a failed lookup means that is not known for sure.
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
  return { domain: baseDomain, listing: null };
};
