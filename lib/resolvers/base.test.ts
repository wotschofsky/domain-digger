import { log } from 'evlog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ALL_RECORD_TYPES } from '@/lib/data';
import { UserFacingError } from '@/lib/user-facing-error';

import { DnsResolver, type RecordType, type ResolverResponse } from './base';

class MockResolver extends DnsResolver {
  public async resolveRecordType(
    domain: string,
    type: RecordType,
  ): Promise<ResolverResponse> {
    return {
      records: [
        {
          name: domain,
          type,
          TTL: 3600,
          data: `data-for-${type}`,
        },
      ],
      trace: [],
    };
  }
}

// Resolves each type to its listed values, or rejects with its error.
class FakeResolver extends DnsResolver {
  constructor(
    private readonly outcomes: Partial<Record<RecordType, string[] | Error>>,
  ) {
    super();
  }

  public async resolveRecordType(
    domain: string,
    type: RecordType,
  ): Promise<ResolverResponse> {
    const outcome = this.outcomes[type] ?? [];
    if (outcome instanceof Error) throw outcome;
    return {
      records: outcome.map((data) => ({ name: domain, type, TTL: 300, data })),
      trace: [],
    };
  }
}

const refused = {
  title: 'Lookup refused',
  description: 'The server refused the lookup.',
  retryable: true,
};

// evlog JSON-stringifies events in production, so only what survives a JSON
// round-trip reaches the log.
const loggedFailures = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls
    .map(([event]) => JSON.parse(JSON.stringify(event)))
    .filter((event) => event.message === 'record_type_lookup_failed');

describe('DnsResolver', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveRecordType', () => {
    it('should resolve a specific record type for a domain', async () => {
      const resolver = new MockResolver();

      const records = await resolver.resolveRecordType('example.com', 'A');

      expect(records).toEqual({
        records: [
          {
            name: 'example.com',
            type: 'A',
            TTL: 3600,
            data: 'data-for-A',
          },
        ],
        trace: [],
      });
    });
  });

  describe('resolveRecordTypes', () => {
    it('should resolve all supported record types for a domain', async () => {
      const resolver = new MockResolver();

      const resolvedRecords = await resolver.resolveRecordTypes(
        'example.com',
        ALL_RECORD_TYPES,
      );

      // Ensure all record types are present and have the expected data
      ALL_RECORD_TYPES.forEach((type) => {
        expect(resolvedRecords[type]).toBeDefined();
        expect(resolvedRecords[type].records[0].type).toBe(type);
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
      expect(resolvedRecords['A'].records[0].data).toBe('data-for-A');
      expect(resolvedRecords['AAAA'].records[0].data).toBe('data-for-AAAA');
    });

    it('keeps resolved types and marks each failed type with its error', async () => {
      vi.spyOn(log, 'warn').mockImplementation(() => {});
      const resolver = new FakeResolver({
        A: ['192.0.2.1'],
        PTR: new UserFacingError(refused),
      });

      const result = await resolver.resolveRecordTypes('example.com', [
        'A',
        'PTR',
      ]);

      expect(result.A.records[0].data).toBe('192.0.2.1');
      expect(result.A.error).toBeUndefined();
      expect(result.PTR).toEqual({ records: [], trace: [], error: refused });
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    });

    it('throws the first failure when every type fails', async () => {
      const first = new UserFacingError(refused);
      const resolver = new FakeResolver({ A: first, AAAA: new Error('bug') });

      await expect(
        resolver.resolveRecordTypes('example.com', ['A', 'AAAA']),
      ).rejects.toBe(first);
    });

    it('throws when the only successes are empty, instead of reporting no records', async () => {
      const failure = new UserFacingError(refused);
      const resolver = new FakeResolver({ A: failure, AAAA: [] });

      await expect(
        resolver.resolveRecordTypes('example.com', ['A', 'AAAA']),
      ).rejects.toBe(failure);
    });

    it('warns for expected failures and errors for bugs without exposing them', async () => {
      const logWarn = vi.spyOn(log, 'warn').mockImplementation(() => {});
      const logError = vi.spyOn(log, 'error').mockImplementation(() => {});
      const resolver = new FakeResolver({
        A: ['192.0.2.1'],
        PTR: new UserFacingError(refused, { cause: new Error('192.0.2.53') }),
        TXT: new Error('private transport details'),
      });

      const result = await resolver.resolveRecordTypes('example.com', [
        'A',
        'PTR',
        'TXT',
      ]);

      expect(result.PTR.error).toEqual(refused);
      expect(result.TXT.error?.title).toBe('DNS lookup failed');
      expect(JSON.stringify(result)).not.toContain('private transport details');
      expect(loggedFailures(logWarn)).toEqual([
        expect.objectContaining({
          domain: 'example.com',
          recordType: 'PTR',
          error: expect.objectContaining({
            message: refused.title,
            stack: expect.any(String),
            cause: expect.stringContaining('192.0.2.53'),
          }),
        }),
      ]);
      expect(loggedFailures(logError)).toEqual([
        expect.objectContaining({
          recordType: 'TXT',
          error: expect.objectContaining({
            message: 'private transport details',
            stack: expect.any(String),
          }),
        }),
      ]);
    });
  });
});
