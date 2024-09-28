import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BaseDoHResolver, type DoHResponse } from './base-doh';

describe('BaseDoHResolver', () => {
  const mockSendRequest = vi.fn();

  const mockDoHResponse = (
    answers: Partial<DoHResponse['Answer'][number]>[] = [],
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

    const resolver = new BaseDoHResolver(mockSendRequest);
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

    const resolver = new BaseDoHResolver(mockSendRequest);
    const records = await resolver.resolveRecordType('example.com', 'A');

    expect(records).toEqual({
      records: [],
      trace: ['HTTPS GET https://dns.google/resolve -> answer: '],
    });
  });

  it('should throw an error for bad HTTP responses', async () => {
    mockSendRequest.mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      url: 'https://dns.google/resolve',
    });

    const resolver = new BaseDoHResolver(mockSendRequest);

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toThrow(
      'Bad response from DoH Resolver: Internal Server Error from https://dns.google/resolve',
    );
  });
});
