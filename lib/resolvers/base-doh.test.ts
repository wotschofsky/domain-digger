import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BaseDoHResolver, type DoHResponse } from './base-doh';

describe('BaseDoHResolver', () => {
  const mockSendRequest = vi.fn();

  class TestDoHResolver extends BaseDoHResolver {}

  const mockDoHResponse = (
    answers: Partial<NonNullable<DoHResponse['Answer']>[number]>[] = [],
  ): DoHResponse => ({
    Status: 0,
    TC: false,
    RD: true,
    RA: true,
    AD: false,
    CD: false,
    Question: [{ name: 'example.com', type: 1 }],
    Answer: answers.map((ans) => ({
      name: ans.name || 'example.com',
      type: ans.type || 1,
      TTL: ans.TTL || 300,
      data: ans.data || 'data',
    })),
  });

  beforeEach(() => {
    mockSendRequest.mockReset();
  });

  it('should correctly resolve records from DoH response', async () => {
    mockSendRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDoHResponse([{ type: 1 }])),
      url: 'https://dns.google/resolve',
    });

    const resolver = new TestDoHResolver(mockSendRequest);
    const records = await resolver.resolveRecordType('example.com', 'A');

    expect(records).toEqual({
      records: [
        {
          name: 'example.com',
          type: 'A',
          TTL: 300,
          data: 'data',
        },
      ],
      trace: ['HTTPS GET https://dns.google/resolve -> answer: data'],
    });
    expect(mockSendRequest).toHaveBeenCalledWith('example.com', 'A');
  });

  it('should handle empty answers by returning an empty array', async () => {
    mockSendRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDoHResponse([])),
      url: 'https://dns.google/resolve',
    });

    const resolver = new TestDoHResolver(mockSendRequest);
    const records = await resolver.resolveRecordType('example.com', 'A');

    expect(records).toEqual({
      records: [],
      trace: ['HTTPS GET https://dns.google/resolve -> answer: '],
    });
  });

  it('should throw a user-facing error for bad HTTP responses', async () => {
    mockSendRequest.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      url: 'https://dns.google/resolve',
    });

    const resolver = new TestDoHResolver(mockSendRequest);

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toThrow(/DNS resolver/);
  });

  it('keeps aliases and TTLs in raw answers while filtering records by type', async () => {
    const answers = [
      { name: 'example.com', type: 5, TTL: 30, data: 'alias.example.' },
      { name: 'alias.example', type: 16, TTL: 300, data: '"some TXT"' },
      { name: 'alias.example', type: 65000, TTL: 300, data: 'unknown type' },
    ];
    mockSendRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ Status: 0, Answer: answers }),
      url: 'https://cloudflare-dns.com/dns-query',
    });
    const resolver = new TestDoHResolver(mockSendRequest);
    expect(
      (await resolver.resolveAnswers('example.com', 'TXT')).answers,
    ).toEqual(answers);
    expect(
      (await resolver.resolveRecordType('example.com', 'TXT')).records,
    ).toEqual([
      { name: 'alias.example', type: 'TXT', TTL: 300, data: '"some TXT"' },
    ]);
  });

  it.each([{ Status: 0 }, { Status: 3 }])(
    'treats %j as an empty answer',
    async (body) => {
      mockSendRequest.mockResolvedValue({
        ok: true,
        json: async () => body,
        url: 'https://cloudflare-dns.com/dns-query',
      });
      const resolver = new TestDoHResolver(mockSendRequest);
      expect(await resolver.resolveRecordType('example.com', 'TXT')).toEqual({
        records: [],
        trace: ['HTTPS GET https://cloudflare-dns.com/dns-query -> no answer'],
      });
    },
  );

  it('preserves aliases when NXDOMAIN describes the end of a CNAME chain', async () => {
    mockSendRequest.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockDoHResponse(),
        Status: 3,
        Answer: [
          { name: 'example.com', type: 5, TTL: 300, data: 'missing.example.' },
        ],
      }),
      url: 'https://cloudflare-dns.com/dns-query',
    });
    const resolver = new TestDoHResolver(mockSendRequest);
    const result = await resolver.resolveAnswers('example.com', 'CNAME');
    expect(result.rcode).toBe(3);
    expect(result.answers).toEqual([
      { name: 'example.com', type: 5, TTL: 300, data: 'missing.example.' },
    ]);
    expect(
      (await resolver.resolveRecordType('example.com', 'CNAME')).records,
    ).toEqual([
      {
        name: 'example.com',
        type: 'CNAME',
        TTL: 300,
        data: 'missing.example.',
      },
    ]);
  });

  it.each([
    { Status: 1 },
    { Status: 2 },
    { Status: 5 },
    { Status: 0, TC: true },
    {},
    { Status: '0' },
    {
      Status: 0,
      Answer: [{ name: 'example.com', type: 16, TTL: -1, data: 'bad' }],
    },
    {
      Status: 0,
      Answer: [{ name: 'example.com', type: 'TXT', TTL: 300, data: 'bad' }],
    },
    {
      Status: 0,
      Answer: [{ name: 'example.com', type: 16, TTL: 300, data: null }],
    },
  ])('rejects DNS errors and malformed responses: %j', async (body) => {
    mockSendRequest.mockResolvedValue({
      ok: true,
      json: async () => body,
      url: 'https://cloudflare-dns.com/dns-query',
    });
    const resolver = new TestDoHResolver(mockSendRequest);
    await expect(
      resolver.resolveRecordType('example.com', 'TXT'),
    ).rejects.toThrow();
  });

  it.each([
    [400, false],
    [429, true],
    [503, true],
  ])('marks HTTP %i as retryable=%s', async (status, retryable) => {
    mockSendRequest.mockResolvedValue({
      ok: false,
      status,
      statusText: 'Failure',
      url: 'https://cloudflare-dns.com/dns-query',
    });
    const resolver = new TestDoHResolver(mockSendRequest);
    await expect(
      resolver.resolveRecordType('example.com', 'TXT'),
    ).rejects.toMatchObject({
      payload: { retryable },
      cause: { message: expect.stringContaining(`HTTP ${status}`) },
    });
  });

  it('propagates transport failures', async () => {
    mockSendRequest.mockRejectedValue(
      new DOMException('Cancelled', 'AbortError'),
    );
    const resolver = new TestDoHResolver(mockSendRequest);
    await expect(resolver.resolveAnswers('example.com', 'TXT')).rejects.toThrow(
      'Cancelled',
    );
  });
});
