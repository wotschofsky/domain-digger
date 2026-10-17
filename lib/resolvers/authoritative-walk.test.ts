// @vitest-environment node
import type { Answer, DecodedPacket } from 'dns-packet';
import { describe, expect, it, vi } from 'vitest';

import { UserFacingError } from '../user-facing-error';
import {
  AuthoritativeResolver,
  type AuthoritativeUdpTransport,
} from './authoritative';
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
const referral = (
  name: string,
  type: RecordType,
  zone: string,
  hosts: string[],
  ips: string[] = [],
): DecodedPacket => ({
  ...reply(name, type),
  flag_aa: false,
  authorities: hosts.map((host) => ({
    name: zone,
    type: 'NS',
    ttl: 300,
    data: host,
  })),
  additionals: ips.map((ip, i) => address(hosts[i], ip)),
});

describe('AuthoritativeResolver walk bounds', () => {
  it('can retry a transient transport failure in a new top-level walk', async () => {
    let available = false;
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) => {
        if (!available) throw new Error('temporary transport failure');
        return reply(domain, recordType, [address(domain)]);
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });
    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toBeInstanceOf(UserFacingError);
    available = true;
    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
    expect(udpTransport).toHaveBeenCalledTimes(5);
  });

  it('stops self-referrals and still tries the healthy sibling', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1')
          return referral(
            domain,
            recordType,
            'example.com',
            ['ns1.example.net', 'ns2.example.net'],
            ['8.8.8.8', '9.9.9.9'],
          );
        if (nameserver === '8.8.8.8')
          return referral(
            domain,
            recordType,
            'example.com',
            ['ns1.example.net'],
            ['8.8.8.8'],
          );
        return reply(domain, recordType, [address(domain)]);
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });
    const result = await resolver.resolveRecordType('www.example.com', 'A');
    expect(result.records[0].data).toBe('203.0.113.10');
    expect(result.trace.join('\n')).toMatch(/referral loop/i);
    expect(udpTransport).toHaveBeenCalledTimes(3);
  });

  it('treats authoritative negative answers with SOA and NS as terminal', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1')
          return referral(
            domain,
            recordType,
            'example.com',
            ['ns1.example.net'],
            ['8.8.8.8'],
          );
        return {
          ...reply(domain, recordType),
          authorities: [
            {
              name: 'example.com',
              type: 'SOA',
              ttl: 300,
              data: {
                mname: 'ns1.example.net',
                rname: 'hostmaster.example.com',
                serial: 1,
                refresh: 300,
                retry: 300,
                expire: 300,
                minimum: 300,
              },
            },
            {
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data: 'ns1.example.net',
            },
          ],
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });
    await expect(
      resolver.resolveRecordType('www.example.com', 'AAAA'),
    ).resolves.toMatchObject({ records: [] });
    expect(udpTransport).toHaveBeenCalledTimes(2);
  });

  it('bounds processing when a small shared request graph forks exponentially', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) => {
        const layer = Number(domain.match(/layer(\d+)/)?.[1] ?? 0);
        if (layer === 10)
          return reply(domain, recordType, [address(domain, '8.8.8.8')]);
        return referral(
          domain,
          recordType,
          domain,
          [1, 2, 3, 4].map((n) => `ns${n}.layer${layer + 1}.test`),
        );
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });
    await expect(
      resolver.resolveRecordType('www.layer0.test', 'A'),
    ).rejects.toBeInstanceOf(Error);
    // Fewer than 50 distinct requests are needed; the separate traversal
    // guard must stop this graph even when the wire budget is not exhausted.
    expect(udpTransport.mock.calls.length).toBeLessThan(50);
  });

  it('counts shared glueless requests once without raising the 50-candidate budget', async () => {
    const hosts = (suffix: string) =>
      [1, 2, 3, 4].map((n) => `ns${n}.${suffix}`);
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1') {
          if (domain.endsWith('.registry.test'))
            return reply(domain, recordType, [address(domain, '8.8.8.8')]);
          if (domain.endsWith('.shared.test'))
            return referral(
              domain,
              recordType,
              'shared.test',
              hosts('registry.test'),
            );
          if (domain.endsWith('.provider.test'))
            return referral(
              domain,
              recordType,
              'provider.test',
              hosts('shared.test'),
            );
          return referral(
            domain,
            recordType,
            'example.test',
            hosts('provider.test'),
          );
        }
        return reply(domain, recordType, [
          address(
            domain,
            nameserver === '8.8.8.8'
              ? '9.9.9.9'
              : nameserver === '9.9.9.9'
                ? '1.1.1.1'
                : '203.0.113.10',
          ),
        ]);
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });
    await expect(
      resolver.resolveRecordType('www.example.test', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
    expect(udpTransport.mock.calls.length).toBeLessThanOrEqual(22);
  });
});
