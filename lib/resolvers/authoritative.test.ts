// @vitest-environment node
import type { Answer, DecodedPacket } from 'dns-packet';
import { describe, expect, it, vi } from 'vitest';

import { UserFacingError } from '../user-facing-error';
import {
  AuthoritativeResolver,
  type AuthoritativeTcpTransport,
  type AuthoritativeUdpTransport,
  isMatchingDnsResponse,
} from './authoritative';
import type { RecordType } from './base';

const response = (
  domain: string,
  type: RecordType,
  rcode: string,
  answers: Answer[] = [],
): DecodedPacket =>
  ({
    type: 'response',
    id: 42,
    flags: 0,
    questions: [{ name: domain, type }],
    answers,
    authorities: [],
    additionals: [],
    rcode,
    // The resolver only reads the fields set above; the flag_* booleans a real
    // decode carries are filled in per-test where a test depends on them.
  }) as unknown as DecodedPacket;

describe('AuthoritativeResolver transport policy', () => {
  it('tries the next nameserver after a retryable DNS rcode', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? response(domain, recordType, 'SERVFAIL')
          : response(domain, recordType, 'NOERROR', [
              {
                name: domain,
                type: 'A',
                ttl: 300,
                data: '203.0.113.10',
              },
            ]),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).resolves.toEqual(
      expect.objectContaining({
        records: [expect.objectContaining({ data: '203.0.113.10' })],
      }),
    );
    expect(
      udpTransport.mock.calls.map(([request]) => request.nameserver),
    ).toEqual(['192.0.2.1', '192.0.2.2']);
  });

  it('returns empty records when every nameserver refuses a plain query', async () => {
    // Cloudflare authoritatives REFUSE direct RRSIG queries; that must not
    // 500 the records page.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) => response(domain, recordType, 'REFUSED'),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'RRSIG'),
    ).resolves.toEqual(expect.objectContaining({ records: [] }));
  });

  it('skips a lame empty response and accepts an authoritative sibling', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? // Empty, not authoritative, no referral: a lame server, not
            // proof of NODATA.
            response(domain, recordType, 'NOERROR')
          : ({
              ...response(domain, recordType, 'NOERROR', [
                { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
              ]),
              flag_aa: true,
            } as DecodedPacket),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).resolves.toEqual(
      expect.objectContaining({
        records: [expect.objectContaining({ data: '203.0.113.10' })],
      }),
    );
  });

  it('accepts an authoritative empty answer as NODATA', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) =>
        ({
          ...response(domain, recordType, 'NOERROR'),
          flag_aa: true,
        }) as DecodedPacket,
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).resolves.toEqual(expect.objectContaining({ records: [] }));
    expect(udpTransport).toHaveBeenCalledTimes(1);
  });

  it('surfaces all-REFUSED plain non-RRSIG queries as retryable failures', async () => {
    // The REFUSED-as-empty tolerance exists for RRSIG browsing only; a domain
    // whose nameservers refuse ordinary lookups must not render "no records".
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) => response(domain, recordType, 'REFUSED'),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it('keeps answers whose owner name differs from the query only by case', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) =>
        response(domain, recordType, 'NOERROR', [
          { name: 'Example.COM', type: 'A', ttl: 300, data: '203.0.113.10' },
        ]),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).resolves.toEqual(
      expect.objectContaining({
        records: [expect.objectContaining({ data: '203.0.113.10' })],
      }),
    );
  });

  it('stops trying fallback nameservers once the deadline is spent', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) =>
        response(domain, recordType, 'SERVFAIL'),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2', '192.0.2.3'],
      fallbackDeadlineMs: 0,
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toBeInstanceOf(UserFacingError);
    // Deadline of 0: only the first candidate is attempted.
    expect(
      new Set(udpTransport.mock.calls.map(([request]) => request.nameserver)),
    ).toEqual(new Set(['192.0.2.1']));
  });

  it('surfaces all-SERVFAIL plain queries as retryable failures', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) =>
        response(domain, recordType, 'SERVFAIL'),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it('fails indeterminately when a DNSSEC-walk query only gets error rcodes', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) => response(domain, recordType, 'REFUSED'),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver['fetchRecordsRaw']({
        domain: 'example.com',
        recordType: 'DNSKEY',
        dnssecOk: true,
      }),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it('retries a truncated UDP answer over TCP', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) =>
        ({
          ...response(domain, recordType, 'NOERROR'),
          flag_tc: true,
        }) as DecodedPacket,
    );
    const tcpTransport = vi.fn<AuthoritativeTcpTransport>(
      async ({ domain, recordType }) =>
        response(domain, recordType, 'NOERROR', [
          {
            name: domain,
            type: 'A',
            ttl: 300,
            data: '203.0.113.11',
          },
        ]),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      tcpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.11');
    expect(udpTransport).toHaveBeenCalledOnce();
    expect(tcpTransport).toHaveBeenCalledOnce();
  });

  it('follows a referral whose answer section holds only unrelated records', async () => {
    // Some servers promote glue into the answer section; nothing there is
    // owned by the queried name, so it must be treated as a referral, not
    // as an authoritative empty answer.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? ({
              ...response(domain, recordType, 'NOERROR', [
                {
                  name: 'ns1.example.net',
                  type: 'A',
                  ttl: 300,
                  data: '8.8.8.8',
                },
              ]),
              authorities: [
                {
                  name: 'example.com',
                  type: 'NS',
                  ttl: 300,
                  data: 'ns1.example.net',
                },
              ],
              additionals: [
                {
                  name: 'ns1.example.net',
                  type: 'A',
                  ttl: 300,
                  data: '8.8.8.8',
                },
              ],
            } as DecodedPacket)
          : response(domain, recordType, 'NOERROR', [
              { name: domain, type: 'A', ttl: 300, data: '203.0.113.13' },
            ]),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('www.example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.13');
  });

  it('follows a glueless referral even when a sibling NS lookup fails', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(async (request) => {
      const { domain, recordType, nameserver } = request;
      if (domain === 'ns-dead.example.net') throw new Error('timeout');
      if (domain === 'ns-live.example.net') {
        return response(domain, recordType, 'NOERROR', [
          { name: domain, type: 'A', ttl: 300, data: '8.8.8.8' },
        ]);
      }
      return nameserver === '192.0.2.1'
        ? ({
            ...response(domain, recordType, 'NOERROR'),
            authorities: [
              {
                name: 'example.com',
                type: 'NS',
                ttl: 300,
                data: 'ns-dead.example.net',
              },
              {
                name: 'example.com',
                type: 'NS',
                ttl: 300,
                data: 'ns-live.example.net',
              },
            ],
          } as DecodedPacket)
        : response(domain, recordType, 'NOERROR', [
            { name: domain, type: 'A', ttl: 300, data: '203.0.113.14' },
          ]);
    });
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('www.example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.14');
  });

  it('follows matching public glue from a referral', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? ({
              ...response(domain, recordType, 'NOERROR'),
              authorities: [
                {
                  name: 'example.com',
                  type: 'NS',
                  ttl: 300,
                  data: 'ns1.example.net',
                },
              ],
              additionals: [
                {
                  name: 'ns1.example.net',
                  type: 'A',
                  ttl: 300,
                  data: '8.8.8.8',
                },
              ],
            } as DecodedPacket)
          : response(domain, recordType, 'NOERROR', [
              {
                name: domain,
                type: 'A',
                ttl: 300,
                data: '203.0.113.12',
              },
            ]),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('www.example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.12');
    expect(
      udpTransport.mock.calls.map(([request]) => request.nameserver),
    ).toEqual(['192.0.2.1', '8.8.8.8']);
  });
});

describe('isMatchingDnsResponse', () => {
  const packet = response('example.com', 'A', 'NOERROR');

  it('requires the transaction ID and question to match', () => {
    expect(isMatchingDnsResponse(packet, 42, 'example.com', 'A')).toBe(true);
    expect(isMatchingDnsResponse(packet, 43, 'example.com', 'A')).toBe(false);
    expect(isMatchingDnsResponse(packet, 42, 'other.example', 'A')).toBe(false);
    expect(isMatchingDnsResponse(packet, 42, 'example.com', 'AAAA')).toBe(
      false,
    );
  });
});
