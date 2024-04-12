import { describe, expect, it } from 'vitest';

import {
  ALL_RECORD_TYPES,
  DnsResolver,
  type RawRecord,
  type RecordType,
} from './base';

class MockResolver extends DnsResolver {
  public async resolveRecordType(
    domain: string,
    type: RecordType
  ): Promise<RawRecord[]> {
    return [
      {
        name: domain,
        type,
        TTL: 3600,
        data: `data-for-${type}`,
      },
    ];
  }
}

describe('DnsResolver', () => {
  describe('resolveRecordType', () => {
    it('should resolve a specific record type for a domain', async () => {
      const resolver = new MockResolver();

      const records = await resolver.resolveRecordType('example.com', 'A');

      expect(records).toEqual([
        {
          name: 'example.com',
          type: 'A',
          TTL: 3600,
          data: 'data-for-A',
        },
      ]);
    });
  });

  describe('resolveRecordTypes', () => {
    it('should resolve all supported record types for a domain', async () => {
      const resolver = new MockResolver();

      const resolvedRecords = await resolver.resolveRecordTypes(
        'example.com',
        ALL_RECORD_TYPES
      );

      // Ensure all record types are present and have the expected data
      ALL_RECORD_TYPES.forEach((type) => {
        expect(resolvedRecords[type]).toBeDefined();
        expect(resolvedRecords[type][0].type).toBe(type);
      });

      // Ensure all and only the expected keys are present
      const expectedKeys = ALL_RECORD_TYPES;
      const resolvedKeys = Object.keys(resolvedRecords);
      expect(resolvedKeys.toSorted()).toEqual(expectedKeys.toSorted());
    });

    it('should resolve only specified record types for a domain', async () => {
      const resolver = new MockResolver();

      const resolvedRecords = await resolver.resolveRecordTypes('example.com', [
        'A',
        'AAAA',
      ]);

      // Ensure only the specified record types are present
      expect(Object.keys(resolvedRecords).toSorted()).toEqual(['A', 'AAAA']);

      // Ensure the specified record types have the expected data
      expect(resolvedRecords['A'][0].data).toBe('data-for-A');
      expect(resolvedRecords['AAAA'][0].data).toBe('data-for-AAAA');
    });
  });
});
