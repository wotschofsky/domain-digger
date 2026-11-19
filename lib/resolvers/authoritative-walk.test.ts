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
    // Two attempts in the first walk, one in the second.
    expect(udpTransport).toHaveBeenCalledTimes(3);
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

  it('stops a circular glueless dependency reached through several roots', async () => {
    const roots = ['192.0.2.1', '192.0.2.2', '192.0.2.3', '192.0.2.4'];
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (roots.includes(nameserver)) {
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
            'h.x3.x2.x1.c.test',
          ]);
        }
        // The healthy NS sits four referrals below c.test.
        const hop = Number(nameserver.split('.')[3]);
        if (nameserver.startsWith('8.8.4.') && hop < 4) {
          const zone = domain
            .split('.')
            .slice(-(2 + hop))
            .join('.');
          return referral(
            domain,
            recordType,
            zone,
            [`ns.${zone}`],
            [`8.8.4.${hop + 1}`],
          );
        }
        return reply(domain, recordType, [
          address(domain, nameserver === '8.8.4.4' ? '9.9.9.9' : undefined),
        ]);
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => roots,
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

  it('tries a sibling when a lame server answers from a zone above the cut', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1')
          return referral(
            domain,
            recordType,
            'sub.example.com',
            ['c.example.net', 'd.example.net'],
            ['8.8.8.8', '9.9.9.9'],
          );
        // Lame for sub.example.com, authoritative only for its parent.
        if (nameserver === '8.8.8.8')
          return nodata(domain, recordType, 'example.com', 'c.example.net');
        return reply(domain, recordType, [address(domain)]);
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });
    await expect(
      resolver.resolveRecordType('www.sub.example.com', 'A'),
    ).resolves.toMatchObject({ records: [{ data: '203.0.113.10' }] });
  });

  it('follows a referral beside a denial from an unrelated zone', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1')
          return referral(
            domain,
            recordType,
            'example.com',
            ['p1.example.net'],
            ['8.8.8.8'],
          );
        // The SOA's zone does not hold the queried name; the NS do.
        if (nameserver === '8.8.8.8') {
          const denial = nodata(
            domain,
            recordType,
            'other.example.com',
            'p1.example.net',
          );
          return {
            ...denial,
            authorities: [
              denial.authorities![0],
              {
                name: 'sub.example.com',
                type: 'NS',
                ttl: 300,
                data: 'c.example.net',
              },
            ],
            additionals: [address('c.example.net', '1.1.1.1')],
          } as DecodedPacket;
        }
        return reply(domain, recordType, [address(domain)]);
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });
    await expect(
      resolver.resolveRecordType('www.sub.example.com', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
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

  it('asks a sibling parent for DS when another answers it from the child zone', async () => {
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
        // A DS-unaware parent server also hosting the child answers from it.
        if (nameserver === '8.8.8.8')
          return nodata(
            domain,
            recordType,
            'sub.example.com',
            'p1.example.net',
          );
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
            ['ns1.evil.test', 'ns2.evil.test'],
            ['8.8.8.8', '9.9.9.9'],
          );
        if (nameserver === '8.8.8.8' && recordType === 'A')
          return reply(domain, recordType, [address(domain)]);
        // A non-authoritative answer from the stale cached delegation must
        // not win just because the step budget ran out.
        if (nameserver === '9.9.9.9')
          return {
            ...reply(domain, recordType, [address(domain, '198.51.100.66')]),
            flag_aa: false,
          } as DecodedPacket;
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

  it('counts a request once whatever the case of its name', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver !== '192.0.2.1')
          return reply(domain, recordType, [address(domain)]);
        if (/\.example\.net\.?$/i.test(domain))
          return reply(domain, recordType, [address(domain, '8.8.8.8')]);
        return referral(domain, recordType, 'example.com', [
          'ns1.example.net',
          'NS1.Example.Net.',
        ]);
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });
    await resolver.resolveRecordType('www.example.com', 'A');
    // Root referral, one shared NS lookup, then the answer.
    expect(udpTransport).toHaveBeenCalledTimes(3);
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

describe('AuthoritativeResolver transport fallbacks', () => {
  it("takes the first server's answer on its retry, not a sibling's broken referral", async () => {
    vi.useFakeTimers();
    try {
      let firstTries = 0;
      const udpTransport = vi.fn<AuthoritativeUdpTransport>(
        async ({ domain, recordType, nameserver }) => {
          if (nameserver === '192.0.2.1')
            return new Promise<DecodedPacket>((resolve, reject) =>
              ++firstTries === 1
                ? setTimeout(() => reject(new Error('timeout')), 1000)
                : setTimeout(
                    () => resolve(reply(domain, recordType, [address(domain)])),
                    500,
                  ),
            );
          if (nameserver === '192.0.2.2')
            return referral(
              domain,
              recordType,
              'example.com',
              [1, 2, 3, 4].map((n) => `ns${n}.example.com`),
              [1, 2, 3, 4].map((n) => `8.8.4.${n}`),
            );
          return new Promise<DecodedPacket>(() => {});
        },
      );
      const resolver = new AuthoritativeResolver({
        udpTransport,
        rootServers: async () => ['192.0.2.1', '192.0.2.2'],
      });

      const result = resolver.resolveRecordType('www.example.com', 'A');
      await vi.advanceTimersByTimeAsync(1500);

      await expect(result).resolves.toMatchObject({
        records: [expect.objectContaining({ data: '203.0.113.10' })],
      });
      expect(
        udpTransport.mock.calls.map(([request]) => request.nameserver),
      ).toEqual(['192.0.2.1', '192.0.2.1']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives a DNSSEC query no plain-DNS retry when a server rejects EDNS', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) =>
        ({ ...reply(domain, recordType), rcode: 'FORMERR' }) as DecodedPacket,
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      dnssecOk: true,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toThrow();
    expect(
      udpTransport.mock.calls.map(([request]) => request.plainDns ?? false),
    ).toEqual([false]);
  });

  it.each(['FORMERR', 'NOTIMP'])(
    'asks again in plain DNS when a server rejects EDNS with %s',
    async (rcode) => {
      const udpTransport = vi.fn<AuthoritativeUdpTransport>(
        async ({ domain, recordType, plainDns }) =>
          plainDns
            ? reply(domain, recordType, [address(domain)])
            : ({
                ...reply(domain, recordType),
                rcode,
              } as DecodedPacket),
      );
      const resolver = new AuthoritativeResolver({
        udpTransport,
        rootServers: async () => ['192.0.2.1'],
      });

      await expect(
        resolver.resolveRecordType('example.com', 'A'),
      ).resolves.toMatchObject({
        records: [expect.objectContaining({ data: '203.0.113.10' })],
      });
      expect(
        udpTransport.mock.calls.map(([request]) => request.plainDns ?? false),
      ).toEqual([false, true]);
    },
  );

  it.each([
    [1, [false, true]],
    [0, [false]],
  ])(
    'asks again in plain DNS only for BADVERS (OPT extended RCODE %i)',
    async (extendedRcode, plainDnsPerCall) => {
      const udpTransport = vi.fn<AuthoritativeUdpTransport>(
        async ({ domain, recordType, plainDns }) =>
          plainDns
            ? reply(domain, recordType, [address(domain)])
            : // BADVERS is RCODE 16: the header's four bits read NOERROR and
              // the OPT record carries the upper bits.
              {
                ...reply(domain, recordType),
                additionals: [
                  {
                    type: 'OPT',
                    name: '.',
                    udpPayloadSize: 1232,
                    extendedRcode,
                    ednsVersion: 0,
                    flags: 0,
                    flag_do: false,
                    options: [],
                  },
                ],
              },
      );
      const resolver = new AuthoritativeResolver({
        udpTransport,
        rootServers: async () => ['192.0.2.1'],
      });

      await resolver.resolveRecordType('example.com', 'A');
      expect(
        udpTransport.mock.calls.map(([request]) => request.plainDns ?? false),
      ).toEqual(plainDnsPerCall);
    },
  );

  it('keeps asking in plain DNS for the rest of the request once a server has rejected EDNS', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, plainDns }) => {
        if (plainDns) throw new Error('timeout');
        return {
          ...reply(domain, recordType),
          rcode: 'FORMERR',
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toThrow();
    expect(
      udpTransport.mock.calls.map(([request]) => request.plainDns ?? false),
    ).toEqual([false, true, true]);
  });
});

describe('AuthoritativeResolver walk timeout', () => {
  it('gives up a walk at its timeout and keeps the types that resolved', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) =>
        recordType === 'TXT'
          ? new Promise<DecodedPacket>(() => {})
          : reply(domain, recordType, [address(domain)]),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
      timeoutMs: 20,
    });

    const records = await resolver.resolveRecordTypes('example.com', [
      'A',
      'TXT',
    ]);

    expect(records.A.records).toEqual([
      expect.objectContaining({ data: '203.0.113.10' }),
    ]);
    expect(records.TXT).toMatchObject({
      records: [],
      error: { title: 'Authoritative DNS servers did not answer in time' },
    });
  });

  it('stops sending once a walk has timed out', async () => {
    vi.useFakeTimers();
    try {
      // Every server refers one level deeper after 900ms, forever.
      let level = 0;
      const udpTransport = vi.fn<AuthoritativeUdpTransport>(
        async ({ domain, recordType }) => {
          level += 1;
          const zone = [
            ...Array.from({ length: level }, (_, i) => `l${level - i}`),
            'example.com',
          ].join('.');
          return new Promise<DecodedPacket>((resolve) =>
            setTimeout(
              () =>
                resolve(
                  referral(
                    domain,
                    recordType,
                    zone,
                    [`ns.${zone}`],
                    [`1.1.1.${level}`],
                  ),
                ),
              900,
            ),
          );
        },
      );
      const resolver = new AuthoritativeResolver({
        udpTransport,
        rootServers: async () => ['192.0.2.1'],
        timeoutMs: 2000,
      });

      const result = resolver.resolveRecordType(
        'www.l9.l8.l7.l6.l5.l4.l3.l2.l1.example.com',
        'A',
      );
      const rejected = expect(result).rejects.toThrow('did not answer in time');
      await vi.advanceTimersByTimeAsync(2000);
      await rejected;
      const sentByTimeout = udpTransport.mock.calls.length;
      await vi.advanceTimersByTimeAsync(5000);

      expect(udpTransport.mock.calls.length).toBe(sentByTimeout);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('AuthoritativeResolver referral probe', () => {
  const mx = (name: string): Answer => ({
    name,
    type: 'MX',
    ttl: 300,
    data: { preference: 10, exchange: 'mail.example.com' },
  });

  it('asks servers above the registrable domain one question for every type but DS', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1')
          return referral(
            domain,
            recordType,
            'com',
            ['a.gtld.test'],
            ['8.8.4.4'],
          );
        if (nameserver === '8.8.4.4')
          return referral(
            domain,
            recordType,
            'example.com',
            ['ns.example.net'],
            ['9.9.9.9'],
          );
        if (recordType === 'A')
          return reply(domain, recordType, [address(domain)]);
        if (recordType === 'MX') return reply(domain, recordType, [mx(domain)]);
        return reply(domain, recordType);
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const records = await resolver.resolveRecordTypes('www.example.com', [
      'A',
      'MX',
      'TXT',
      'DS',
    ]);

    const asked = (nameserver: string) =>
      udpTransport.mock.calls
        .filter(([request]) => request.nameserver === nameserver)
        .map(([request]) => request.recordType)
        .toSorted();
    // DS asks for itself: the parent zone holds it.
    expect(asked('192.0.2.1')).toEqual(['A', 'DS']);
    expect(asked('8.8.4.4')).toEqual(['A', 'DS']);
    expect(asked('9.9.9.9')).toEqual(['A', 'DS', 'MX', 'TXT']);
    expect(records.MX.records).toEqual([
      expect.objectContaining({ data: '10 mail.example.com' }),
    ]);
    expect(records.MX.trace).toEqual([
      'A www.example.com @ 192.0.2.1 (udp) -> redirect to 8.8.4.4',
      'A www.example.com @ 8.8.4.4 (udp) -> redirect to 9.9.9.9',
      'MX www.example.com @ 9.9.9.9 (udp) -> answer: 10 mail.example.com',
    ]);
  });

  it('asks its own question where the probe is answered, not referred', async () => {
    // A registry server that hosts the name itself (parent and child on one
    // server set): its answer to A says nothing about MX.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) =>
        reply(
          domain,
          recordType,
          recordType === 'A' ? [address(domain)] : [mx(domain)],
        ),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('example.com', 'MX');

    expect(result.records).toEqual([
      expect.objectContaining({ data: '10 mail.example.com' }),
    ]);
    expect(
      udpTransport.mock.calls.map(([request]) => request.recordType),
    ).toEqual(['A', 'MX']);
  });

  it('shares an authoritative NXDOMAIN from above the registrable domain', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? referral(domain, recordType, 'com', ['a.gtld.test'], ['8.8.4.4'])
          : ({
              ...nodata(domain, recordType, 'com', 'a.gtld.test'),
              rcode: 'NXDOMAIN',
            } as DecodedPacket),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const [mxResult, txtResult] = await Promise.all([
      resolver.resolveAnswers('missing.com', 'MX'),
      resolver.resolveAnswers('missing.com', 'TXT'),
    ]);

    expect(mxResult).toMatchObject({ answers: [], rcode: 'NXDOMAIN' });
    expect(txtResult).toMatchObject({ answers: [], rcode: 'NXDOMAIN' });
    expect(
      udpTransport.mock.calls.filter(
        ([request]) => request.nameserver === '8.8.4.4',
      ),
    ).toHaveLength(1);
  });
});
