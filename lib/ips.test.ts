import isIP from 'validator/lib/isIP';
import { describe, expect, it, vi } from 'vitest';

import {
  ipToDnsName,
  ipv4ToDnsName,
  ipv6ToDnsName,
  lookupReverse,
  normalizeIpEnding,
} from './ips';

describe('ipv4ToDnsName', () => {
  it('should convert an IPv4 address to a reverse DNS lookup format', () => {
    expect(ipv4ToDnsName('8.8.8.8')).toBe('8.8.8.8.in-addr.arpa');
  });
});

describe('ipv6ToDnsName', () => {
  it('should convert an IPv6 address to a reverse DNS lookup format', () => {
    expect(ipv6ToDnsName('2001:db8::1')).toBe(
      '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    );
  });
});

describe('ipToDnsName', () => {
  it('should convert an IPv4 address to a reverse DNS lookup format', () => {
    expect(ipToDnsName('8.8.8.8')).toBe('8.8.8.8.in-addr.arpa');
  });

  it('should convert an IPv6 address to a reverse DNS lookup format', () => {
    expect(ipToDnsName('2001:db8::1')).toBe(
      '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
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

  it('should throw an error when the API call for DNS lookup fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Service Unavailable',
    });

    await expect(lookupReverse('8.8.4.4')).rejects.toThrow(
      'Error fetching DNS records: Service Unavailable',
    );
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
