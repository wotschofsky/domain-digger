import { describe, expect, it } from 'vitest';

import { normalizeDomain, parseSearchInput } from './search-parser';

describe('normalizeDomain', () => {
  it('normalizes domains with URLs', () => {
    expect(normalizeDomain('http://example.com')).toBe('example.com');
    expect(normalizeDomain('https://example.com')).toBe('example.com');
    expect(normalizeDomain('https://www.example.com/path')).toBe(
      'www.example.com',
    );
  });

  it('normalizes domains with trailing dots', () => {
    expect(normalizeDomain('example.com.')).toBe('example.com');
    expect(normalizeDomain('www.example.com.')).toBe('www.example.com');
  });

  it('normalizes domains to lowercase', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
    expect(normalizeDomain('WWW.EXAMPLE.COM')).toBe('www.example.com');
    expect(normalizeDomain('Sub.Domain.Example.COM')).toBe(
      'sub.domain.example.com',
    );
  });

  it('handles punycode domains', () => {
    expect(normalizeDomain('xn--fiqs8s')).toBe('xn--fiqs8s'); // Chinese "中国"
    expect(normalizeDomain('münchen.de')).toBe('xn--mnchen-3ya.de');
  });

  it('trims whitespace', () => {
    expect(normalizeDomain('  example.com  ')).toBe('example.com');
    expect(normalizeDomain('\t\nexample.com\n\t')).toBe('example.com');
  });

  it('handles invalid URLs gracefully', () => {
    expect(normalizeDomain('invalid-url')).toBe('invalid-url');
    expect(normalizeDomain('example.com')).toBe('example.com');
  });

  it('handles edge cases', () => {
    expect(normalizeDomain('')).toBe('');
    expect(normalizeDomain('.')).toBe('');
    expect(normalizeDomain('..')).toBe('.');
  });
});

describe('parseSearchInput', () => {
  describe('empty input', () => {
    it('returns empty type for empty strings', () => {
      expect(parseSearchInput('')).toEqual({ type: 'empty' });
      expect(parseSearchInput('  ')).toEqual({ type: 'empty' });
      expect(parseSearchInput('\t\n')).toEqual({ type: 'empty' });
    });
  });

  describe('IP addresses', () => {
    it('detects IPv4 addresses', () => {
      expect(parseSearchInput('8.8.8.8')).toEqual({
        type: 'ip',
        value: '8.8.8.8',
      });
      expect(parseSearchInput('192.168.1.1')).toEqual({
        type: 'ip',
        value: '192.168.1.1',
      });
      expect(parseSearchInput('127.0.0.1')).toEqual({
        type: 'ip',
        value: '127.0.0.1',
      });
      expect(parseSearchInput('255.255.255.255')).toEqual({
        type: 'ip',
        value: '255.255.255.255',
      });
    });

    it('detects IPv6 addresses', () => {
      expect(parseSearchInput('2001:4860:4860::8888')).toEqual({
        type: 'ip',
        value: '2001:4860:4860::8888',
      });
      expect(parseSearchInput('::1')).toEqual({
        type: 'ip',
        value: '::1',
      });
      expect(parseSearchInput('::')).toEqual({
        type: 'ip',
        value: '::',
      });
      expect(parseSearchInput('fe80::1%lo0')).toEqual({
        type: 'ip',
        value: 'fe80::1%lo0',
      });
    });

    it('handles IP addresses with whitespace', () => {
      expect(parseSearchInput('  8.8.8.8  ')).toEqual({
        type: 'ip',
        value: '8.8.8.8',
      });
    });
  });

  describe('domain names', () => {
    it('detects valid domains', () => {
      expect(parseSearchInput('example.com')).toEqual({
        type: 'domain',
        value: 'example.com',
      });
      expect(parseSearchInput('www.example.com')).toEqual({
        type: 'domain',
        value: 'www.example.com',
      });
      expect(parseSearchInput('subdomain.example.co.uk')).toEqual({
        type: 'domain',
        value: 'subdomain.example.co.uk',
      });
    });

    it('normalizes domains during parsing', () => {
      expect(parseSearchInput('EXAMPLE.COM')).toEqual({
        type: 'domain',
        value: 'example.com',
      });
      expect(parseSearchInput('  www.example.com  ')).toEqual({
        type: 'domain',
        value: 'www.example.com',
      });
      expect(parseSearchInput('example.com.')).toEqual({
        type: 'domain',
        value: 'example.com',
      });
    });

    it('handles URLs as input', () => {
      expect(parseSearchInput('https://example.com')).toEqual({
        type: 'domain',
        value: 'example.com',
      });
      expect(parseSearchInput('http://www.example.com/path')).toEqual({
        type: 'domain',
        value: 'www.example.com',
      });
      expect(
        parseSearchInput('https://sub.domain.example.com:8080/path?query=1'),
      ).toEqual({
        type: 'domain',
        value: 'sub.domain.example.com',
      });
    });

    it('handles wildcard domains', () => {
      expect(parseSearchInput('*.example.com')).toEqual({
        type: 'domain',
        value: '*.example.com',
      });
    });

    it('handles punycode domains', () => {
      expect(parseSearchInput('xn--fiqs8s')).toEqual({
        type: 'domain',
        value: 'xn--fiqs8s',
      });
      expect(parseSearchInput('münchen.de')).toEqual({
        type: 'domain',
        value: 'xn--mnchen-3ya.de',
      });
    });
  });

  describe('email addresses', () => {
    it('extracts domain from email addresses', () => {
      expect(parseSearchInput('user@example.com')).toEqual({
        type: 'domain',
        value: 'example.com',
      });
      expect(parseSearchInput('test.user@subdomain.example.com')).toEqual({
        type: 'domain',
        value: 'subdomain.example.com',
      });
      expect(parseSearchInput('user+tag@example.co.uk')).toEqual({
        type: 'domain',
        value: 'example.co.uk',
      });
    });

    it('handles complex email formats', () => {
      expect(parseSearchInput('user.name+tag@sub.domain.example.com')).toEqual({
        type: 'domain',
        value: 'sub.domain.example.com',
      });
      expect(parseSearchInput('test@münchen.de')).toEqual({
        type: 'domain',
        value: 'xn--mnchen-3ya.de',
      });
    });

    it('handles malformed emails gracefully', () => {
      expect(parseSearchInput('user@')).toEqual({
        type: 'invalid',
      });
      expect(parseSearchInput('@example.com')).toEqual({
        type: 'domain',
        value: 'example.com',
      });
    });
  });

  describe('invalid input', () => {
    it('returns invalid for malformed domains', () => {
      expect(parseSearchInput('invalid')).toEqual({
        type: 'invalid',
      });
      expect(parseSearchInput('example')).toEqual({
        type: 'invalid',
      });
      expect(parseSearchInput('-example.com')).toEqual({
        type: 'invalid',
      });
      expect(parseSearchInput('.com')).toEqual({
        type: 'invalid',
      });
    });

    it('returns invalid for malformed IPs', () => {
      expect(parseSearchInput('256.256.256.256')).toEqual({
        type: 'invalid',
      });
      expect(parseSearchInput('192.168.1')).toEqual({
        type: 'invalid',
      });
    });

    it('returns invalid for special characters', () => {
      expect(parseSearchInput('example..com')).toEqual({
        type: 'invalid',
      });
      expect(parseSearchInput('exa_mple.com')).toEqual({
        type: 'invalid',
      });
    });
  });

  describe('edge cases', () => {
    it('handles mixed input types', () => {
      // Test that @ parsing works with various combinations
      expect(parseSearchInput('multiple@signs@example.com')).toEqual({
        type: 'domain',
        value: 'example.com',
      });
    });

    it('handles very long domains', () => {
      const longDomain = 'very.long.subdomain.with.many.parts.example.com';
      expect(parseSearchInput(longDomain)).toEqual({
        type: 'domain',
        value: longDomain,
      });
    });

    it('handles international domains', () => {
      expect(parseSearchInput('тест.рф')).toEqual({
        type: 'domain',
        value: 'xn--e1aybc.xn--p1ai',
      });
      expect(parseSearchInput('测试.中国')).toEqual({
        type: 'domain',
        value: 'xn--0zwm56d.xn--fiqs8s',
      });
    });
  });
});
