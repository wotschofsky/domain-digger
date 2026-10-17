// @vitest-environment node
import type { Answer, DecodedPacket } from 'dns-packet';
import { describe, expect, it, vi } from 'vitest';

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
describe('AuthoritativeResolver partial results', () => {
  it('preserves A records and explicitly marks a refused PTR lookup as failed', async () => {
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
  });
});
