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
): DecodedPacket =>
  ({
    type: 'response',
    id: 1,
    questions: [{ name, type }],
    answers,
    authorities: [],
    additionals: [],
    rcode: 'NOERROR',
    flag_aa: true,
  }) as unknown as DecodedPacket;
// Authoritative NODATA carrying the zone's SOA and NS (RFC 2308 type 1).
const nodata = (name: string, type: RecordType, zone: string, host: string) =>
  ({
    ...reply(name, type),
    authorities: [
      {
        name: zone,
        type: 'SOA',
        ttl: 300,
        data: {
          mname: host,
          rname: `hostmaster.${zone}`,
          serial: 1,
          refresh: 300,
          retry: 300,
          expire: 300,
          minimum: 300,
        },
      },
      { name: zone, type: 'NS', ttl: 300, data: host },
    ],
  }) as DecodedPacket;
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

  it('stops a circular glueless dependency before it starves a slower sibling', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (nameserver === '192.0.2.1') {
          if (domain.endsWith('.c.test'))
            return referral(
              domain,
              recordType,
              'c.test',
              ['ns.c.test'],
              ['8.8.4.1'],
            );
          // a.test and b.test name each other's servers, without glue.
          if (domain.endsWith('.b.test'))
            return referral(domain, recordType, 'b.test', [
              'ns1.a.test',
              'ns2.a.test',
            ]);
          return referral(domain, recordType, 'a.test', [
            'ns1.b.test',
            'ns2.b.test',
            'h.deep.c.test',
          ]);
        }
        // The healthy NS needs more round trips than the cycle takes to warm.
        if (nameserver === '8.8.4.1')
          return referral(
            domain,
            recordType,
            'deep.c.test',
            ['ns.deep.c.test'],
            ['8.8.4.2'],
          );
        if (nameserver === '8.8.4.2')
          return reply(domain, recordType, [address(domain, '8.8.8.8')]);
        if (nameserver === '9.9.9.9')
          return reply(domain, recordType, [address(domain, '8.8.8.8')]);
        return reply(domain, recordType, [
          address(
            domain,
            domain.startsWith('www.') ? '203.0.113.10' : '9.9.9.9',
          ),
        ]);
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });
    await expect(
      resolver.resolveRecordType('www.a.test', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
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
        return nodata(domain, recordType, 'example.com', 'ns1.example.net');
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

  it('asks a sibling parent for DS when another refers it to the child apex', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1')
          return referral(
            domain,
            recordType,
            'example.com',
            ['p1.example.net', 'p2.example.net'],
            ['8.8.8.8', '9.9.9.9'],
          );
        // A DS-unaware parent server refers the query to the child.
        if (nameserver === '8.8.8.8')
          return referral(
            domain,
            recordType,
            'sub.example.com',
            ['ns1.example.org'],
            ['1.1.1.1'],
          );
        if (nameserver === '9.9.9.9')
          return reply(domain, recordType, [
            {
              name: domain,
              type: 'DS',
              ttl: 300,
              data: {
                keyTag: 1,
                algorithm: 13,
                digestType: 2,
                digest: Buffer.from('ab', 'hex'),
              },
            },
          ]);
        // The child apex answers its own DS with NODATA.
        return nodata(domain, recordType, 'sub.example.com', 'ns1.example.org');
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });
    await expect(
      resolver.resolveAnswers('sub.example.com', 'DS'),
    ).resolves.toMatchObject({
      answers: [expect.objectContaining({ type: 'DS' })],
      zone: 'example.com',
    });
  });

  it('keeps a spent step budget user-facing after a cached delegation fails', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        const layer = Number(domain.match(/layer(\d+)/)?.[1] ?? 0);
        if (nameserver === '192.0.2.1' && !layer)
          return referral(
            domain,
            recordType,
            'evil.test',
            ['ns1.evil.test'],
            ['8.8.8.8'],
          );
        if (nameserver === '8.8.8.8' && recordType === 'A')
          return reply(domain, recordType, [address(domain)]);
        // Every further hop forks into four glueless NS names.
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
    await resolver.resolveRecordType('www.evil.test', 'A');
    await expect(
      resolver.resolveRecordType('www.evil.test', 'TXT'),
    ).rejects.toBeInstanceOf(UserFacingError);
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
