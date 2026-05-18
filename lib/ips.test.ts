import isIP from 'validator/lib/isIP';
import { describe, expect, it, vi } from 'vitest';

import {
  getIpDetails,
  ipToDnsName,
  ipv4ToDnsName,
  ipv6ToDnsName,
  lookupReverse,
  normalizeIpEnding,
} from './ips';

describe('ipv4ToDnsName', () => {
  // Intentionally omit the trailing root dot: these names are used as DNS query
  // inputs, not DNS master-file absolute-name presentation strings.
  it('should convert an IPv4 address to a reverse DNS lookup format', () => {
    expect(ipv4ToDnsName('8.8.8.8')).toBe('8.8.8.8.in-addr.arpa');
  });

  it('should reverse non-symmetric IPv4 octets', () => {
    expect(ipv4ToDnsName('192.0.2.1')).toBe('1.2.0.192.in-addr.arpa');
  });
});

describe('ipv6ToDnsName', () => {
  // Intentionally omit the trailing root dot: these names are used as DNS query
  // inputs, not DNS master-file absolute-name presentation strings.
  it('should convert an IPv6 address to a reverse DNS lookup format', () => {
    expect(ipv6ToDnsName('2001:db8::1')).toBe(
      '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    );
  });

  it('should normalize uppercase IPv6 hex digits to lowercase reverse labels', () => {
    expect(ipv6ToDnsName('2001:DB8::1')).toBe(
      '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    );
  });

  it('should convert a fully expanded IPv6 address to a reverse DNS lookup format', () => {
    expect(ipv6ToDnsName('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
      '4.3.3.7.0.7.3.0.e.2.a.8.0.0.0.0.0.0.0.0.3.a.5.8.8.b.d.0.1.0.0.2.ip6.arpa',
    );
  });

  it('should pad short hextets in an uncompressed IPv6 address', () => {
    expect(ipv6ToDnsName('2001:db8:1:2:3:4:5:6')).toBe(
      '6.0.0.0.5.0.0.0.4.0.0.0.3.0.0.0.2.0.0.0.1.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    );
  });

  it('should expand :: when it represents exactly one zero hextet', () => {
    expect(ipv6ToDnsName('2001:db8:0:1::2:3:4')).toBe(
      '4.0.0.0.3.0.0.0.2.0.0.0.0.0.0.0.1.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    );
  });

  it('should convert an IPv4-mapped IPv6 address to a reverse DNS lookup format', () => {
    expect(ipv6ToDnsName('::ffff:192.0.2.128')).toBe(
      '0.8.2.0.0.0.0.c.f.f.f.f.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.ip6.arpa',
    );
  });

  it('should convert an IPv4-embedded IPv6 address to a reverse DNS lookup format', () => {
    expect(ipv6ToDnsName('2001:db8::192.0.2.33')).toBe(
      '1.2.2.0.0.0.0.c.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    );
  });

  it('should expand "::" to all-zero hextets', () => {
    expect(ipv6ToDnsName('::')).toBe(
      '0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.ip6.arpa',
    );
  });

  it('should expand a leading "::" prefix', () => {
    expect(ipv6ToDnsName('::1')).toBe(
      '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.ip6.arpa',
    );
  });

  it('should expand a trailing "::" suffix', () => {
    expect(ipv6ToDnsName('2001:db8::')).toBe(
      '0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    );
  });

  it('should produce exactly 32 nibbles for any valid IPv6 address', () => {
    const inputs = [
      '2001:db8::1',
      '::',
      '::1',
      '2001:db8::',
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      'fe80::250:56ff:fe97:2b82',
      'abcd:ef01::3456:7890',
    ];

    for (const ip of inputs) {
      expect(isIP(ip), `precondition: ${ip} is a valid IP`).toBe(true);
      const name = ipv6ToDnsName(ip);
      expect(name.endsWith('.ip6.arpa'), `${ip} -> ${name}`).toBe(true);
      const nibbles = name.slice(0, -'.ip6.arpa'.length).split('.');
      expect(nibbles.length, `${ip} -> ${name}`).toBe(32);
      for (const nibble of nibbles) {
        expect(nibble, `${ip} -> ${name}`).toMatch(/^[0-9a-f]$/);
      }
    }
  });
});

describe('ipToDnsName', () => {
  it('should convert an IPv4 address to a reverse DNS lookup format', () => {
    expect(ipToDnsName('8.8.8.8')).toBe('8.8.8.8.in-addr.arpa');
  });

  it('should reverse non-symmetric IPv4 octets', () => {
    expect(ipToDnsName('192.0.2.1')).toBe('1.2.0.192.in-addr.arpa');
  });

  it('should convert an IPv6 address to a reverse DNS lookup format', () => {
    expect(ipToDnsName('2001:db8::1')).toBe(
      '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    );
  });
});

describe('getIpDetails', () => {
  it('should throw a user-facing error for invalid IP addresses', async () => {
    await expect(getIpDetails('not-an-ip')).rejects.toThrow(
      /Invalid IP address/,
    );
    await expect(getIpDetails('../../../etc/passwd')).rejects.toThrow(
      /Invalid IP address/,
    );
    await expect(getIpDetails('999.999.999.999')).rejects.toThrow(
      /Invalid IP address/,
    );
  });
});

describe('lookupReverse', () => {
  it('should return an array of domain names from reverse DNS lookups', async () => {
    const fakeResponse = {
      json: vi.fn().mockResolvedValue({
        Answer: [{ data: 'dns.google.' }, { data: 'another.dns.google.' }],
      }),
      ok: true,
    };
    global.fetch = vi.fn().mockResolvedValue(fakeResponse);

    const results = await lookupReverse('8.8.8.8');
    expect(results).toEqual(['dns.google', 'another.dns.google']);
  });

  it('should return an empty array if no answers are found in the DNS lookup', async () => {
    const fakeResponse = {
      json: vi.fn().mockResolvedValue({}),
      ok: true,
    };
    global.fetch = vi.fn().mockResolvedValue(fakeResponse);

    const results = await lookupReverse('8.8.4.4');
    expect(results).toEqual([]);
  });

  it('should throw a user-facing error when the API call for DNS lookup fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(lookupReverse('8.8.4.4')).rejects.toThrow(/Cloudflare DNS/);
  });
});

describe('normalizeIpEnding', () => {
  it('should normalize the last octet of an IPv4 address to .0', () => {
    expect(normalizeIpEnding('192.168.1.254')).toBe('192.168.1.0');
    expect(normalizeIpEnding('10.0.0.1')).toBe('10.0.0.0');
  });

  it('should normalize the last group of an IPv6 address to 0', () => {
    expect(normalizeIpEnding('fe80::250:56ff:fe97:2b82')).toBe(
      'fe80::250:56ff:fe97:0',
    );
    expect(normalizeIpEnding('2001:db8::1428:57ab')).toBe('2001:db8::1428:0');
  });

  it('should not alter the IP address if there is no trailing segment to normalize', () => {
    expect(normalizeIpEnding('192.168.1.0')).toBe('192.168.1.0');
    expect(normalizeIpEnding('2001:db8::1428:0')).toBe('2001:db8::1428:0');
  });

  it('should canonicalize compressed zero-tail IPv6 to the same key as the expanded form', () => {
    expect(normalizeIpEnding('2001:db8::')).toBe(
      normalizeIpEnding('2001:db8::0'),
    );
    expect(normalizeIpEnding('fe80::')).toBe(normalizeIpEnding('fe80::0'));
    expect(normalizeIpEnding('::')).toBe(normalizeIpEnding('::0'));
  });

  it('should still normalize based on pattern even for non-standard inputs', () => {
    expect(normalizeIpEnding('999.999.999.999')).toBe('999.999.999.0');
    expect(normalizeIpEnding('abcd:ef01::3456:7890')).toBe('abcd:ef01::3456:0');
  });

  it('should produce a valid IP address for valid inputs', () => {
    const inputs = [
      '192.168.1.254',
      '10.0.0.1',
      '8.8.8.8',
      'fe80::250:56ff:fe97:2b82',
      '2001:db8::1428:57ab',
      'abcd:ef01::3456:7890',
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      '::1',
    ];

    for (const ip of inputs) {
      expect(isIP(ip), `precondition: ${ip} is a valid IP`).toBe(true);
      const normalized = normalizeIpEnding(ip);
      expect(isIP(normalized), `${ip} -> ${normalized}`).toBe(true);
    }
  });
});
