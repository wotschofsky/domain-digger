// @vitest-environment node
import type { Answer, DecodedPacket, Packet } from 'dns-packet';
import { describe, expect, it, vi } from 'vitest';

import { UserFacingError } from '../user-facing-error';
import {
  AuthoritativeResolver,
  type AuthoritativeTcpTransport,
  type AuthoritativeTransport,
  type AuthoritativeUdpTransport,
  isMatchingDnsResponse,
} from './authoritative';
import type { RecordType } from './base';

const response = (
  domain: string,
  type: RecordType,
  rcode: string,
  answers: Answer[] = [],
): Packet =>
  ({
    type: 'response',
    id: 42,
    flags: 0,
    questions: [{ name: domain, type }],
    answers,
    authorities: [],
    additionals: [],
    rcode,
  }) as Packet;

describe('AuthoritativeResolver transport policy', () => {
  it('tries the next nameserver after a retryable DNS rcode', async () => {
    const transport = vi.fn<AuthoritativeTransport>(
      async ({ domain, recordType, nameserver }) => ({
        packet:
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
        protocol: 'udp',
        truncated: false,
      }),
    );
    const resolver = new AuthoritativeResolver({
      transport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).resolves.toEqual(
      expect.objectContaining({
        records: [expect.objectContaining({ data: '203.0.113.10' })],
      }),
    );
    expect(transport.mock.calls.map(([request]) => request.nameserver)).toEqual(
      ['192.0.2.1', '192.0.2.2'],
    );
  });

  it('returns empty records when every nameserver refuses a plain query', async () => {
    // Cloudflare authoritatives REFUSE direct RRSIG queries; that must not
    // 500 the records page.
    const transport = vi.fn<AuthoritativeTransport>(
      async ({ domain, recordType }) => ({
        packet: response(domain, recordType, 'REFUSED'),
        protocol: 'udp',
        truncated: false,
      }),
    );
    const resolver = new AuthoritativeResolver({
      transport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'RRSIG'),
    ).resolves.toEqual(expect.objectContaining({ records: [] }));
  });

  it('surfaces all-SERVFAIL plain queries as retryable failures', async () => {
    const transport = vi.fn<AuthoritativeTransport>(
      async ({ domain, recordType }) => ({
        packet: response(domain, recordType, 'SERVFAIL'),
        protocol: 'udp',
        truncated: false,
      }),
    );
    const resolver = new AuthoritativeResolver({
      transport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it('fails indeterminately when a DNSSEC-walk query only gets error rcodes', async () => {
    const transport = vi.fn<AuthoritativeTransport>(
      async ({ domain, recordType }) => ({
        packet: response(domain, recordType, 'REFUSED'),
        protocol: 'udp',
        truncated: false,
      }),
    );
    const resolver = new AuthoritativeResolver({
      transport,
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

  it('follows matching public glue from a referral', async () => {
    const transport = vi.fn<AuthoritativeTransport>(
      async ({ domain, recordType, nameserver }) => ({
        packet:
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
              } as Packet)
            : response(domain, recordType, 'NOERROR', [
                {
                  name: domain,
                  type: 'A',
                  ttl: 300,
                  data: '203.0.113.12',
                },
              ]),
        protocol: 'udp',
        truncated: false,
      }),
    );
    const resolver = new AuthoritativeResolver({
      transport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('www.example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.12');
    expect(transport.mock.calls.map(([request]) => request.nameserver)).toEqual(
      ['192.0.2.1', '8.8.8.8'],
    );
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
