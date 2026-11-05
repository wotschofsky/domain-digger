import { log } from 'evlog';
import { describe, expect, it, vi } from 'vitest';

import { getGlobalLookupResults, getHasDifferences } from './map';
import {
  DnsResolver,
  type RecordType,
  type ResolverResponse,
} from './resolvers/base';
import { UserFacingError } from './user-facing-error';

vi.mock('./data', () => ({
  REGIONS: {
    fra: { lat: 50.033333, lng: 8.570556, name: '🇩🇪 Frankfurt, Germany' },
    iad: { lat: 38.944, lng: -77.456, name: '🇺🇸 Washington, USA' },
  },
}));

const mockResolveRecordTypes = vi.fn().mockImplementation(() => ({
  A: { records: [{ data: '1.2.3.4' }], trace: [] },
  AAAA: {
    records: [{ data: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' }],
    trace: [],
  },
  CNAME: { records: [{ data: 'alias.example.com' }], trace: [] },
}));

const resolverFactory = vi.fn().mockImplementation(() => ({
  resolveRecordTypes: mockResolveRecordTypes,
}));

describe('getGlobalLookupResults', () => {
  it('should resolve DNS records for all regions and format results', async () => {
    const results = await getGlobalLookupResults(
      'example.com',
      resolverFactory,
    );
    expect(resolverFactory).toHaveBeenCalledTimes(2);
    expect(mockResolveRecordTypes).toHaveBeenCalledWith('example.com', [
      'A',
      'AAAA',
      'CNAME',
    ]);
    expect(results).toEqual([
      {
        code: 'fra',
        lat: 50.033333,
        lng: 8.570556,
        name: '🇩🇪 Frankfurt, Germany',
        results: {
          A: ['1.2.3.4'],
          AAAA: ['2001:0db8:85a3:0000:0000:8a2e:0370:7334'],
          CNAME: ['alias.example.com'],
        },
      },
      {
        code: 'iad',
        lat: 38.944,
        lng: -77.456,
        name: '🇺🇸 Washington, USA',
        results: {
          A: ['1.2.3.4'],
          AAAA: ['2001:0db8:85a3:0000:0000:8a2e:0370:7334'],
          CNAME: ['alias.example.com'],
        },
      },
    ]);
  });
});

// Answers every type the same way in each region, except the failing ones,
// which fail like a SERVFAIL from a DoH resolver.
class RegionResolver extends DnsResolver {
  constructor(private readonly failing: readonly RecordType[] = []) {
    super();
  }

  public async resolveRecordType(
    domain: string,
    type: RecordType,
  ): Promise<ResolverResponse> {
    if (this.failing.includes(type)) {
      throw new UserFacingError({
        title: 'DNS resolver could not complete the lookup',
        description: 'SERVFAIL',
      });
    }
    return {
      records: [{ name: domain, type, TTL: 300, data: `${type} data` }],
      trace: [],
    };
  }
}

describe('getGlobalLookupResults with failures', () => {
  vi.spyOn(log, 'warn').mockImplementation(() => {});

  it('treats a failed type as unknown rather than as different records', async () => {
    const results = await getGlobalLookupResults('example.com', (code) =>
      code === 'fra' ? new RegionResolver(['A']) : new RegionResolver(),
    );
    expect(results.map((region) => region.results)).toEqual([
      { A: null, AAAA: ['AAAA data'], CNAME: ['CNAME data'] },
      { A: ['A data'], AAAA: ['AAAA data'], CNAME: ['CNAME data'] },
    ]);
    expect(getHasDifferences(results.map((region) => region.results))).toBe(
      false,
    );
  });

  it('keeps the other regions when one region fails entirely', async () => {
    const results = await getGlobalLookupResults('example.com', (code) =>
      code === 'fra'
        ? new RegionResolver(['A', 'AAAA', 'CNAME'])
        : new RegionResolver(),
    );
    expect(results.map((region) => region.results)).toEqual([
      { A: null, AAAA: null, CNAME: null },
      { A: ['A data'], AAAA: ['AAAA data'], CNAME: ['CNAME data'] },
    ]);
    expect(getHasDifferences(results.map((region) => region.results))).toBe(
      false,
    );
  });

  it('throws when every region fails', async () => {
    await expect(
      getGlobalLookupResults(
        'example.com',
        () => new RegionResolver(['A', 'AAAA', 'CNAME']),
      ),
    ).rejects.toBeInstanceOf(UserFacingError);
  });
});

describe('getHasDifferences', () => {
  it('should detect differences between DNS record sets', () => {
    const markers = [
      { A: ['1.2.3.4'], AAAA: ['2001:db8::1'], CNAME: ['alias.example.com'] },
      { A: ['1.2.3.5'], AAAA: ['2001:db8::1'], CNAME: ['alias.example.com'] },
    ];
    expect(getHasDifferences(markers)).toBe(true);
  });

  it('should detect no differences when all record sets are identical', () => {
    const markers = [
      { A: ['1.2.3.4'], AAAA: ['2001:db8::1'], CNAME: ['alias.example.com'] },
      { A: ['1.2.3.4'], AAAA: ['2001:db8::1'], CNAME: ['alias.example.com'] },
    ];
    expect(getHasDifferences(markers)).toBe(false);
  });
});
