import { describe, expect, it } from 'vitest';

import { isPublicIp } from './ip-filter';

describe('isPublicIp', () => {
  describe('invalid input', () => {
    it.each([
      '',
      'not-an-ip',
      '256.0.0.1',
      '1.2.3',
      '1.2.3.4.5',
      'gggg::',
      '::g',
    ])('returns false for %j', (input) => {
      expect(isPublicIp(input)).toBe(false);
    });
  });

  describe('IPv4 private/reserved ranges', () => {
    it.each([
      // Unspecified / "this network"
      '0.0.0.0',
      '0.1.2.3',
      // Private RFC1918
      '10.0.0.1',
      '10.255.255.255',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '192.168.255.255',
      // Loopback
      '127.0.0.1',
      '127.1.2.3',
      // Link-local
      '169.254.0.1',
      '169.254.169.254',
      // Carrier-grade NAT
      '100.64.0.1',
      '100.127.255.254',
      // Documentation / TEST-NET
      '192.0.2.1',
      '198.51.100.1',
      '203.0.113.1',
      // Benchmarking
      '198.18.0.1',
      '198.19.255.254',
      // IETF protocol assignments
      '192.0.0.1',
      // Multicast
      '224.0.0.1',
      '239.255.255.255',
      // Reserved / broadcast
      '240.0.0.1',
      '255.255.255.255',
    ])('rejects %s', (ip) => {
      expect(isPublicIp(ip)).toBe(false);
    });
  });

  describe('IPv4 public addresses', () => {
    it.each([
      '1.1.1.1',
      '8.8.8.8',
      '9.9.9.9',
      '198.41.0.4', // a.root-servers.net
      '192.5.6.30', // a.gtld-servers.net
      '172.15.255.255', // just outside private range
      '172.32.0.1', // just outside private range
      '192.167.255.255', // just outside private range
      '100.63.255.255', // just outside CGN range
      '100.128.0.0', // just outside CGN range
      '169.253.255.255', // just outside link-local
      '169.255.0.0', // just outside link-local
      '223.255.255.255', // just below multicast
    ])('accepts %s', (ip) => {
      expect(isPublicIp(ip)).toBe(true);
    });
  });

  describe('IPv6 private/reserved ranges', () => {
    it.each([
      // Unspecified
      '::',
      // Loopback
      '::1',
      // IPv4-mapped private addresses
      '::ffff:127.0.0.1',
      '::ffff:10.0.0.1',
      '::ffff:192.168.1.1',
      // Unique-local
      'fc00::1',
      'fd12:3456:789a::1',
      // Link-local
      'fe80::1',
      'febf:ffff::1',
      // Multicast
      'ff00::1',
      'ff02::1',
      // Discard prefix
      '100::1',
      // Documentation
      '2001:db8::1',
      '2001:0db8:1234::',
      // Well-known NAT64
      '64:ff9b::1.2.3.4',
    ])('rejects %s', (ip) => {
      expect(isPublicIp(ip)).toBe(false);
    });
  });

  describe('IPv6 public addresses', () => {
    it.each([
      '2001:4860:4860::8888', // Google DNS
      '2606:4700:4700::1111', // Cloudflare DNS
      '2620:fe::fe', // Quad9
      '::ffff:8.8.8.8', // IPv4-mapped public
      'fbff::1', // just below fc00::/7
    ])('accepts %s', (ip) => {
      expect(isPublicIp(ip)).toBe(true);
    });
  });
});
