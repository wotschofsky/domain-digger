import { describe, expect, it } from 'vitest';

import { getVisitorIp, isUserBot } from './api';

describe('getVisitorIp', () => {
  it('should extract the first IP from x-forwarded-for', () => {
    const headers = new Headers({
      'x-forwarded-for': '192.168.1.1, 192.168.1.2',
    });

    const ip = getVisitorIp(headers);
    expect(ip).toBe('192.168.1.1');
  });

  it('should default to 127.0.0.1 if x-forwarded-for is not present', () => {
    const headers = new Headers();

    const ip = getVisitorIp(headers);
    expect(ip).toBe('127.0.0.1');
  });
});

describe('isUserBot', () => {
  it('should identify a user as a bot based on user-agent', () => {
    const headers = new Headers({
      'User-Agent':
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });

    const { isBot, userAgent } = isUserBot(headers);
    expect(isBot).toBe(true);
    expect(userAgent).toBe(
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    );
  });

  it('should identify a human user based on user-agent', () => {
    const headers = new Headers({
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
    });

    const { isBot, userAgent } = isUserBot(headers);
    expect(isBot).toBe(false);
    expect(userAgent).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
    );
  });

  it('should default to isBot=true when user-agent header is missing', () => {
    const headers = new Headers();

    const { isBot, userAgent } = isUserBot(headers);
    expect(isBot).toBe(true);
    expect(userAgent).toBeNull();
  });
});
