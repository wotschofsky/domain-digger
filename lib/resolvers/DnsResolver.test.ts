import { describe, expect, it } from 'vitest';

import DnsResolver, {
  type RawRecord,
  RECORD_TYPES,
  type RecordType,
} from './DnsResolver';

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

  describe('resolveAllRecords', () => {
    it('should resolve all supported record types for a domain', async () => {
      const resolver = new MockResolver();

      const resolvedRecords = await resolver.resolveAllRecords('example.com');

      // Ensure all record types are present and have the expected data
      RECORD_TYPES.forEach((type) => {
        expect(resolvedRecords[type]).toBeDefined();
        expect(resolvedRecords[type][0].type).toBe(type);
      });

      // Ensure all and only the expected keys are present
      const expectedKeys = RECORD_TYPES;
      const resolvedKeys = Object.keys(resolvedRecords);
      expect(resolvedKeys.toSorted()).toEqual(expectedKeys.toSorted());
    });
  });
});
