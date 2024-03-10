import { describe, expect, it } from 'vitest';

import { normalizeIpEnding } from './ips';

describe('normalizeIpEnding', () => {
  it('should normalize the last octet of an IPv4 address to .0', () => {
    expect(normalizeIpEnding('192.168.1.254')).toBe('192.168.1.0');
    expect(normalizeIpEnding('10.0.0.1')).toBe('10.0.0.0');
  });

  it('should normalize IPv6 by removing the last segment after a colon', () => {
    expect(normalizeIpEnding('fe80::250:56ff:fe97:2b82')).toBe(
      'fe80::250:56ff:fe97:'
    );
    expect(normalizeIpEnding('2001:db8::1428:57ab')).toBe('2001:db8::1428:');
  });

  it('should not alter the IP address if there is no trailing segment to normalize', () => {
    expect(normalizeIpEnding('192.168.1.0')).toBe('192.168.1.0');
    expect(normalizeIpEnding('2001:db8::1428:')).toBe('2001:db8::1428:');
  });

  it('should still normalize based on pattern even for non-standard inputs', () => {
    expect(normalizeIpEnding('999.999.999.999')).toBe('999.999.999.0');
    expect(normalizeIpEnding('abcd:ef01::3456:7890')).toBe('abcd:ef01::3456:');
  });
});
