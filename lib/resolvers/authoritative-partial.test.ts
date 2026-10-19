// @vitest-environment node
import type { Answer, DecodedPacket } from 'dns-packet';
import { log } from 'evlog';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserFacingError } from '../user-facing-error';
import { AuthoritativeResolver } from './authoritative';
import type { RecordType } from './base';

const reply = (
  name: string,
  type: RecordType,
  answers: Answer[] = [],
  rcode = 'NOERROR',
): DecodedPacket =>
  ({
    type: 'response',
    id: 1,
    questions: [{ name, type }],
    answers,
    authorities: [],
    additionals: [],
    rcode,
    flag_aa: true,
  }) as unknown as DecodedPacket;
const address = (name: string, data = '203.0.113.10'): Answer => ({
  name,
  type: 'A',
  ttl: 300,
  data,
});
// evlog JSON-stringifies events in production, so only what survives a JSON
// round-trip reaches the log.
const loggedFailures = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls
    .map(([event]) => JSON.parse(JSON.stringify(event)))
    .filter((event) => event.message === 'record_type_lookup_failed');

describe('AuthoritativeResolver partial results', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves A records and explicitly marks a refused PTR lookup as failed', async () => {
    const logWarn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    const logError = vi.spyOn(log, 'error').mockImplementation(() => {});
    const resolver = new AuthoritativeResolver({
      rootServers: async () => ['192.0.2.1'],
      udpTransport: async ({ domain, recordType }) =>
        recordType === 'A'
          ? reply(domain, recordType, [address(domain)])
          : reply(domain, recordType, [], 'REFUSED'),
    });
    const result = await resolver.resolveRecordTypes('example.com', [
      'A',
      'PTR',
    ]);
    expect(result.A.records[0].data).toBe('203.0.113.10');
    expect(result.A.error).toBeUndefined();
    expect(result.PTR).toMatchObject({
      records: [],
      error: { retryable: true },
    });
    expect(result.PTR.error?.title).toBeTruthy();
    expect(JSON.parse(JSON.stringify(result)).PTR.error).toEqual(
      result.PTR.error,
    );
    expect(loggedFailures(logError)).toEqual([]);
    expect(loggedFailures(logWarn)).toEqual([
      expect.objectContaining({
        domain: 'example.com',
        recordType: 'PTR',
        error: expect.objectContaining({
          message: 'Authoritative DNS servers did not answer',
          stack: expect.any(String),
          cause: expect.stringContaining('192.0.2.1'),
        }),
      }),
    ]);
  });

  it('does not turn a failed lookup with only empty successful types into no records', async () => {
    const resolver = new AuthoritativeResolver({
      rootServers: async () => ['192.0.2.1'],
      udpTransport: async ({ domain, recordType }) =>
        reply(
          domain,
          recordType,
          [],
          recordType === 'A' ? 'REFUSED' : 'NOERROR',
        ),
    });
    await expect(
      resolver.resolveRecordTypes('example.com', ['A', 'AAAA']),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it('does not serialize unexpected internal errors into partial results', async () => {
    const logWarn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    const logError = vi.spyOn(log, 'error').mockImplementation(() => {});
    const resolver = new AuthoritativeResolver({
      rootServers: async () => ['192.0.2.1'],
      udpTransport: async ({ domain, recordType }) =>
        reply(domain, recordType, [address(domain)]),
    });
    const singleType = resolver.resolveRecordType.bind(resolver);
    vi.spyOn(resolver, 'resolveRecordType').mockImplementation(
      (domain, type) =>
        type === 'PTR'
          ? Promise.reject(new Error('private transport details'))
          : singleType(domain, type),
    );
    const result = await resolver.resolveRecordTypes('example.com', [
      'A',
      'PTR',
    ]);
    expect(result.PTR.error?.title).toBe('DNS lookup failed');
    expect(JSON.stringify(result)).not.toContain('private transport details');
    expect(loggedFailures(logWarn)).toEqual([]);
    expect(loggedFailures(logError)).toEqual([
      expect.objectContaining({
        recordType: 'PTR',
        error: expect.objectContaining({
          message: 'private transport details',
          stack: expect.any(String),
        }),
      }),
    ]);
  });
});
