import { describe, expect, it, vi } from 'vitest';

import { getGlobalLookupResults, getHasDifferences } from './map';

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
