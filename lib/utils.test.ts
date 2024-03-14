import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';

import { isAppleDevice, isValidDomain, retry } from './utils';

describe('retry', () => {
  let warnSpy: MockInstance;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should succeed without retrying if the function does not throw', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const result = await retry(mockFn, 2);
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should retry the specified number of times on failure, then succeed', async () => {
    const error = new Error('Test error');
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');
    const result = await retry(mockFn, 2);
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(error.message.toString());
  });

  it('should throw the last error after exhausting all retries', async () => {
    const error = new Error('Test error');
    const mockFn = vi.fn().mockRejectedValue(error);
    try {
      await retry(mockFn, 2);
      throw new Error(
        'This should not execute if retry throws the expected error'
      );
    } catch (err) {
      expect(err).toBe(error);
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledTimes(2);
    }
  });
});

describe('isValidDomain', () => {
  it('validates typical domains', () => {
    expect(isValidDomain('example.com')).toBe(true);
    expect(isValidDomain('subdomain.example.com')).toBe(true);
    expect(isValidDomain('www.example.co.uk')).toBe(true);
    expect(isValidDomain('xn--fiqs8s')).toBe(true); // Punycode example for Chinese "中国"
    expect(isValidDomain('example')).toBe(true); // Only TLD
  });

  it('validates wildcard domains', () => {
    expect(isValidDomain('*.example.com')).toBe(true);
  });

  it('rejects invalid domains', () => {
    expect(isValidDomain('-example.com')).toBe(false); // Starts with a hyphen
    expect(isValidDomain('.com')).toBe(false); // No domain name
    expect(isValidDomain('exa_mple.com')).toBe(false); // Underscore in domain
    expect(isValidDomain('example..com')).toBe(false); // Double dot
  });
});

// User agent strings from https://gist.github.com/pzb/b4b6f57144aea7827ae4
describe('isAppleDevice', () => {
  it('detects Apple devices', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.22 Safari/537.36'
    );
    expect(isAppleDevice()).toBe(true);

    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12A365 Safari/600.1.4'
    );
    expect(isAppleDevice()).toBe(true);

    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPad;U;CPU OS 5_1_1 like Mac OS X; zh-cn)AppleWebKit/534.46.0(KHTML, like Gecko)CriOS/19.0.1084.60 Mobile/9B206 Safari/7534.48.3'
    );
  });

  it('detects non-Apple devices', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/37.0.2062.94 Chrome/37.0.2062.94 Safari/537.36'
    );
    expect(isAppleDevice()).toBe(false);

    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'
    );
    expect(isAppleDevice()).toBe(false);

    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/68.0'
    );
    expect(isAppleDevice()).toBe(false);
  });

  it('returns false when window is undefined', () => {
    expect(isAppleDevice()).toBe(false);
  });
});
