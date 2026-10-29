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

  it.each([
    ['NOTIMP', 'REFUSED'],
    ['NOTIMP', 'NOTIMP'],
  ])(
    'keeps the records page usable when RRSIG browsing returns %s and %s',
    async (first, second) => {
      const resolver = new AuthoritativeResolver({
        rootServers: async () => ['192.0.2.1', '192.0.2.2'],
        udpTransport: async ({ domain, recordType, nameserver }) => ({
          ...response(
            domain,
            recordType,
            recordType === 'RRSIG'
              ? nameserver === '192.0.2.1'
                ? first
                : second
              : 'NOERROR',
            recordType === 'A'
              ? [{ name: domain, type: 'A', ttl: 300, data: '203.0.113.10' }]
              : [],
          ),
          flag_aa: true,
        }),
      });
      await expect(
        resolver.resolveRecordTypes('example.com', ['A', 'RRSIG']),
      ).resolves.toEqual(
        expect.objectContaining({
          A: expect.objectContaining({
            records: [expect.objectContaining({ data: '203.0.113.10' })],
          }),
          RRSIG: expect.objectContaining({ records: [] }),
        }),
      );
    },
  );

  it.each(['SERVFAIL', 'FORMERR'])(
    'does not hide RRSIG %s mixed with NOTIMP',
    async (rcode) => {
      const resolver = new AuthoritativeResolver({
        rootServers: async () => ['192.0.2.1', '192.0.2.2'],
        udpTransport: async ({ domain, recordType, nameserver }) =>
          response(
            domain,
            recordType,
            nameserver === '192.0.2.1' ? 'NOTIMP' : rcode,
          ),
      });
      await expect(
        resolver.resolveRecordType('example.com', 'RRSIG'),
      ).rejects.toBeInstanceOf(UserFacingError);
    },
  );

  it('keeps NOTIMP an error for ordinary record types', async () => {
    const resolver = new AuthoritativeResolver({
      rootServers: async () => ['192.0.2.1'],
      udpTransport: async ({ domain, recordType }) =>
        response(domain, recordType, 'NOTIMP'),
    });
    await expect(
      resolver.resolveRecordType('example.com', 'A'),
    ).rejects.toBeInstanceOf(UserFacingError);
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

  it('exposes NXDOMAIN separately from an empty NOERROR answer', async () => {
    const resolver = new AuthoritativeResolver({
      udpTransport: async ({ domain, recordType }) =>
        ({
          ...response(
            domain,
            recordType,
            domain === 'missing.example' ? 'NXDOMAIN' : 'NOERROR',
          ),
          flag_aa: true,
        }) as DecodedPacket,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveAnswers('missing.example', 'DNSKEY'),
    ).resolves.toEqual(
      expect.objectContaining({ answers: [], rcode: 'NXDOMAIN' }),
    );
    await expect(
      resolver.resolveAnswers('empty.example', 'DNSKEY'),
    ).resolves.toEqual(
      expect.objectContaining({ answers: [], rcode: 'NOERROR' }),
    );
  });

  it('returns decoded DNSKEY rdata from resolveAnswers', async () => {
    const key = {
      flags: 257,
      algorithm: 13,
      key: Buffer.from('AQIDBA==', 'base64'),
    };
    const resolver = new AuthoritativeResolver({
      udpTransport: async ({ domain, recordType }) =>
        ({
          ...response(domain, recordType, 'NOERROR', [
            { name: domain, type: 'DNSKEY', ttl: 60, data: key },
          ]),
          flag_aa: true,
        }) as DecodedPacket,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveAnswers('example.com', 'DNSKEY'),
    ).resolves.toEqual(
      expect.objectContaining({
        answers: [expect.objectContaining({ type: 'DNSKEY', data: key })],
        zone: '.',
      }),
    );
  });

  it('reports the zone cut a referral led to, even when its servers answer NODATA', async () => {
    const resolver = new AuthoritativeResolver({
      udpTransport: async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? ({
              ...response(domain, recordType, 'NOERROR'),
              authorities: [
                {
                  name: 'www.example.com',
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
          : ({
              ...response(domain, recordType, 'NOERROR'),
              flag_aa: true,
            } as DecodedPacket),
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveAnswers('www.example.com', 'SOA'),
    ).resolves.toEqual(
      expect.objectContaining({
        answers: [],
        rcode: 'NOERROR',
        zone: 'www.example.com',
      }),
    );
  });

  it('keeps the DO bit across a referral and returns only covering RRSIGs', async () => {
    const rrsig = (name: string, typeCovered: string) =>
      ({ name, type: 'RRSIG', ttl: 300, data: { typeCovered } }) as Answer;
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
          : ({
              ...response(domain, recordType, 'NOERROR', [
                {
                  name: domain,
                  type: 'DNSKEY',
                  ttl: 300,
                  data: { flags: 257, algorithm: 13, key: Buffer.alloc(64) },
                },
                // Owner names are case-insensitive.
                rrsig('Example.COM', 'DNSKEY'),
                rrsig(domain, 'SOA'),
                rrsig('www.example.com', 'DNSKEY'),
              ]),
              flag_aa: true,
            } as DecodedPacket),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
      dnssecOk: true,
    });

    const result = await resolver.resolveAnswers('example.com', 'DNSKEY');

    expect(result.answers).toHaveLength(1);
    expect(result.coveringRrsigs).toEqual([{ typeCovered: 'DNSKEY' }]);
    expect(udpTransport).toHaveBeenCalledTimes(2);
    expect(udpTransport.mock.calls.every(([request]) => request.dnssecOk)).toBe(
      true,
    );
  });

  it('does not report a dangling CNAME target as NXDOMAIN for the queried name', async () => {
    // RFC 6604: the rcode describes the end of the chain, not the owner.
    const resolver = new AuthoritativeResolver({
      udpTransport: async ({ domain, recordType }) =>
        ({
          ...response(domain, recordType, 'NXDOMAIN', [
            {
              name: domain,
              type: 'CNAME',
              ttl: 60,
              data: 'gone.example.com',
            },
          ]),
          flag_aa: true,
        }) as DecodedPacket,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveAnswers('dangling.example.com', 'SOA'),
    ).resolves.toEqual(
      expect.objectContaining({ answers: [], rcode: 'NOERROR' }),
    );
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

  it('surfaces all-SERVFAIL RRSIG queries as retryable failures', async () => {
    // The all-REFUSED tolerance is rcode-specific: SERVFAIL means the servers
    // are broken, not that they decline RRSIG browsing by policy.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) =>
        response(domain, recordType, 'SERVFAIL'),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver.resolveRecordType('example.com', 'RRSIG'),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it('skips a non-authoritative response whose answers are all unrelated', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? // Unrelated answer, not authoritative, no referral: as lame as an
            // empty response -- it must not read as NODATA.
            response(domain, recordType, 'NOERROR', [
              {
                name: 'unrelated.example.net',
                type: 'A',
                ttl: 300,
                data: '8.8.8.8',
              },
            ])
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

  it('treats a non-authoritative reply whose only redirect is a stray A as lame', async () => {
    // An A record in additionals without any NS delegates nothing; accepting
    // the reply would dead-end in "Bad redirects" instead of trying siblings.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? ({
              ...response(domain, recordType, 'NOERROR'),
              additionals: [
                {
                  name: 'unrelated.example.net',
                  type: 'A',
                  ttl: 300,
                  data: '8.8.8.8',
                },
              ],
            } as DecodedPacket)
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

  it('treats an upward referral as lame and tries the sibling', async () => {
    // Classic lame-delegation symptom: a misconfigured server "refers" the
    // query back to the root instead of answering for its zone.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? ({
              ...response(domain, recordType, 'NOERROR'),
              authorities: [
                { name: '.', type: 'NS', ttl: 300, data: 'a.root-servers.net' },
              ],
            } as DecodedPacket)
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

  it('classifies a non-AA reply with only an out-of-bailiwick delegation as lame', async () => {
    // No in-bailiwick NS, so this is not a referral we can follow; it is lame
    // and the sibling is tried. (The glue for the foreign zone must never be
    // contacted.)
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? ({
              ...response(domain, recordType, 'NOERROR'),
              authorities: [
                { name: 'evil.org', type: 'NS', ttl: 300, data: 'ns.evil.org' },
              ],
              additionals: [
                { name: 'ns.evil.org', type: 'A', ttl: 300, data: '6.6.6.6' },
              ],
            } as DecodedPacket)
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

    const result = await resolver.resolveRecordType('example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.10');
    expect(
      udpTransport.mock.calls.map(([request]) => request.nameserver),
    ).not.toContain('6.6.6.6');
  });

  it('follows only in-bailiwick public glue from a mixed referral', async () => {
    // An accepted referral (in-bailiwick NS present) that also carries an
    // out-of-bailiwick delegation, its glue, and a private-IP glue for the
    // real NS. The walk must follow only 8.8.8.8 and touch none of the traps.
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
                { name: 'evil.org', type: 'NS', ttl: 300, data: 'ns.evil.org' },
              ],
              // Traps first: if a filter regressed, the recursive walk would
              // contact the trap before 8.8.8.8 (the mock answers from any
              // server) and trip the not.toContain assertions. With 8.8.8.8
              // ordered first the test would pass on loop order alone.
              additionals: [
                {
                  name: 'ns1.example.net',
                  type: 'A',
                  ttl: 300,
                  data: '10.0.0.1',
                },
                { name: 'ns.evil.org', type: 'A', ttl: 300, data: '6.6.6.6' },
                {
                  name: 'ns1.example.net',
                  type: 'A',
                  ttl: 300,
                  data: '8.8.8.8',
                },
              ],
            } as DecodedPacket)
          : ({
              ...response(domain, recordType, 'NOERROR', [
                { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
              ]),
              flag_aa: true,
            } as DecodedPacket),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('www.example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.10');
    const contacted = udpTransport.mock.calls.map(
      ([request]) => request.nameserver,
    );
    expect(contacted).toContain('8.8.8.8');
    expect(contacted).not.toContain('10.0.0.1');
    expect(contacted).not.toContain('6.6.6.6');
  });

  it('rejects a glueless NS that resolves to a private IP', async () => {
    // SSRF guard: the delegated NS hostname is attacker-controlled and here
    // resolves to an RFC1918 address; the resolver must never send to it.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(async (request) => {
      const { domain, recordType, nameserver } = request;
      if (domain === 'ns.example.net') {
        return response(domain, recordType, 'NOERROR', [
          { name: domain, type: 'A', ttl: 300, data: '10.0.0.1' },
        ]);
      }
      if (nameserver === '192.0.2.1') {
        return {
          ...response(domain, recordType, 'NOERROR'),
          authorities: [
            {
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data: 'ns.example.net',
            },
          ],
        } as DecodedPacket;
      }
      return response(domain, recordType, 'SERVFAIL');
    });
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).rejects.toThrow();
    expect(
      udpTransport.mock.calls.map(([request]) => request.nameserver),
    ).not.toContain('10.0.0.1');
  });

  it('tries a healthy sibling when a candidate referral fails to resolve', async () => {
    // The first root hands out a referral whose only nameserver is dead. That
    // must not abort the lookup -- the sibling root answers authoritatively.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1') {
          return {
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
              { name: 'ns1.example.net', type: 'A', ttl: 300, data: '8.8.8.8' },
            ],
          } as DecodedPacket;
        }
        if (nameserver === '8.8.8.8') {
          return response(domain, recordType, 'SERVFAIL');
        }
        // 192.0.2.2, the healthy sibling root.
        return {
          ...response(domain, recordType, 'NOERROR', [
            { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
          ]),
          flag_aa: true,
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    const result = await resolver.resolveRecordType('www.example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.10');
    expect(
      udpTransport.mock.calls.map(([request]) => request.nameserver),
    ).toContain('192.0.2.2');
  });

  it('falls back to a deferred answer when a later referral fails', async () => {
    // First root: a non-authoritative answer (deferred). Second root: an
    // in-bailiwick referral that then fails. The deferred answer must win
    // over failing the lookup.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1') {
          return response(domain, recordType, 'NOERROR', [
            { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
          ]);
        }
        if (nameserver === '192.0.2.2') {
          return {
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
              { name: 'ns1.example.net', type: 'A', ttl: 300, data: '8.8.8.8' },
            ],
          } as DecodedPacket;
        }
        // 8.8.8.8, the dead delegated server.
        return response(domain, recordType, 'SERVFAIL');
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    const result = await resolver.resolveRecordType('www.example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.10');
  });

  it('dedupes duplicate glue so a distinct healthy address survives the cap', async () => {
    // Four colocated NS hostnames share one dead IP; a fifth carries a
    // healthy address. Without dedup the cap of 4 retains only duplicates
    // and drops the healthy one.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1') {
          return {
            ...response(domain, recordType, 'NOERROR'),
            authorities: [1, 2, 3, 4, 5].map((i) => ({
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data: `ns${i}.example.net`,
            })),
            additionals: [
              { name: 'ns1.example.net', type: 'A', ttl: 300, data: '9.9.9.9' },
              { name: 'ns2.example.net', type: 'A', ttl: 300, data: '9.9.9.9' },
              { name: 'ns3.example.net', type: 'A', ttl: 300, data: '9.9.9.9' },
              { name: 'ns4.example.net', type: 'A', ttl: 300, data: '9.9.9.9' },
              { name: 'ns5.example.net', type: 'A', ttl: 300, data: '8.8.8.8' },
            ],
          } as DecodedPacket;
        }
        if (nameserver === '9.9.9.9') {
          return response(domain, recordType, 'SERVFAIL');
        }
        // 8.8.8.8, the distinct healthy server.
        return {
          ...response(domain, recordType, 'NOERROR', [
            { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
          ]),
          flag_aa: true,
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('www.example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.10');
    expect(
      udpTransport.mock.calls.map(([request]) => request.nameserver),
    ).toContain('8.8.8.8');
  });

  it('retries with sibling nameservers that resolved after the race', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(async (request) => {
      const { domain, recordType, nameserver } = request;
      if (domain === 'ns-fast.example.net') {
        return response(domain, recordType, 'NOERROR', [
          { name: domain, type: 'A', ttl: 300, data: '8.8.8.8' },
        ]);
      }
      if (domain === 'ns-slow.example.net') {
        await new Promise((resolveSleep) => setTimeout(resolveSleep, 50));
        return response(domain, recordType, 'NOERROR', [
          { name: domain, type: 'A', ttl: 300, data: '9.9.9.9' },
        ]);
      }
      if (nameserver === '192.0.2.1') {
        return {
          ...response(domain, recordType, 'NOERROR'),
          authorities: [
            {
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data: 'ns-fast.example.net',
            },
            {
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data: 'ns-slow.example.net',
            },
          ],
        } as DecodedPacket;
      }
      if (nameserver === '8.8.8.8') {
        // The winner's server fails instantly, while the sibling NS lookup
        // is still in flight -- the retry must wait for it.
        return response(domain, recordType, 'SERVFAIL');
      }
      return {
        ...response(domain, recordType, 'NOERROR', [
          { name: domain, type: 'A', ttl: 300, data: '203.0.113.14' },
        ]),
        flag_aa: true,
      } as DecodedPacket;
    });
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('www.example.com', 'A');

    expect(result.records[0]?.data).toBe('203.0.113.14');
    // The walk went ahead with the fast sibling alone.
    expect(result.trace).toContainEqual(
      expect.stringContaining('retrying with late sibling nameservers'),
    );
  });

  it('bounds total queries against a zone that forks glueless delegations', async () => {
    // A crafted zone can answer every glueless delegation with four fresh NS
    // names; without a walk-wide query budget the tree grows 4^depth.
    let seq = 0;
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) =>
        ({
          ...response(domain, recordType, 'NOERROR'),
          authorities: [1, 2, 3, 4].map((i) => ({
            name: domain,
            type: 'NS',
            ttl: 300,
            data: `ns${i}-${seq++}.example.net`,
          })),
        }) as DecodedPacket,
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).rejects.toBeInstanceOf(Error);
    expect(udpTransport.mock.calls.length).toBeLessThanOrEqual(50);
  });

  it('prefers an authoritative sibling over a non-authoritative answer', async () => {
    // An open recursive listed in the NS set answers without AA; its data
    // must not mask the healthy authoritative sibling.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? response(domain, recordType, 'NOERROR', [
              { name: domain, type: 'A', ttl: 300, data: '198.51.100.99' },
            ])
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
    expect(
      udpTransport.mock.calls.map(([request]) => request.nameserver),
    ).toEqual(['192.0.2.1', '192.0.2.2']);
  });

  it('falls back to a non-authoritative answer when no candidate does better', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? response(domain, recordType, 'NOERROR', [
              { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
            ])
          : response(domain, recordType, 'SERVFAIL'),
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

  it('shares the fallback deadline across referral steps', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1') {
          // Slow referral: spends the whole walk deadline before handing out
          // the two child addresses.
          await new Promise((resolveSleep) => setTimeout(resolveSleep, 250));
          return {
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
              { name: 'ns1.example.net', type: 'A', ttl: 300, data: '8.8.8.8' },
              { name: 'ns1.example.net', type: 'A', ttl: 300, data: '9.9.9.9' },
            ],
          } as DecodedPacket;
        }
        return nameserver === '8.8.8.8'
          ? response(domain, recordType, 'SERVFAIL')
          : ({
              ...response(domain, recordType, 'NOERROR', [
                { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
              ]),
              flag_aa: true,
            } as DecodedPacket);
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
      fallbackDeadlineMs: 100,
    });

    // A per-step deadline would reset after the referral and reach 9.9.9.9;
    // the walk-wide deadline must not.
    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).rejects.toBeInstanceOf(UserFacingError);
    expect(
      udpTransport.mock.calls.map(([request]) => request.nameserver),
    ).not.toContain('9.9.9.9');
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

  it('resolves the glueless NS names when the only glued server fails', async () => {
    // Like whu.edu: the referral glues only ns.example.com, which is down,
    // while the unglued ns1.example.net answers fine. It also lists the dead
    // address, which must stay out of the cached delegation.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '8.8.8.8') throw new Error('timeout');
        if (nameserver === '192.0.2.1' && domain.endsWith('.example.net'))
          return {
            ...response(domain, recordType, 'NOERROR', [
              { name: domain, type: 'A', ttl: 300, data: '8.8.8.8' },
              { name: domain, type: 'A', ttl: 300, data: '9.9.9.9' },
            ]),
            flag_aa: true,
          } as DecodedPacket;
        if (nameserver === '192.0.2.1')
          return {
            ...response(domain, recordType, 'NOERROR'),
            authorities: ['ns.example.com', 'ns1.example.net'].map((data) => ({
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data,
            })),
            additionals: [
              { name: 'ns.example.com', type: 'A', ttl: 300, data: '8.8.8.8' },
            ],
          } as DecodedPacket;
        return {
          ...response(domain, recordType, 'NOERROR', [
            { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
          ]),
          flag_aa: true,
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('www.example.com', 'A');
    expect(result.records).toEqual([
      expect.objectContaining({ data: '203.0.113.10' }),
    ]);
    expect(result.trace).toContainEqual(
      expect.stringMatching(
        /glue for example\.com \(8\.8\.8\.8\) failed .*8\.8\.8\.8: timeout \(4 attempts\).*resolving NS names instead/,
      ),
    );
    // The healthy servers replace the dead glue in the delegation cache.
    udpTransport.mockClear();
    const cachedResult = await resolver.resolveRecordType(
      'mail.example.com',
      'A',
    );
    expect(cachedResult.trace[0]).toMatch(
      /starting at cached delegation example\.com: 9\.9\.9\.9/,
    );
    expect(udpTransport).not.toHaveBeenCalledWith(
      expect.objectContaining({ nameserver: '8.8.8.8' }),
    );
  });

  it('traces the failed attempts a nameserver was retried after', async () => {
    let attempts = 0;
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType }) => {
        if (++attempts < 3) throw new Error(`timeout ${attempts}`);
        return {
          ...response(domain, recordType, 'NOERROR', [
            { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
          ]),
          flag_aa: true,
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    const result = await resolver.resolveRecordType('example.com', 'A');

    expect(result.trace).toEqual([
      'A example.com @ 192.0.2.1 -> retried after 2 failed attempts: timeout 1; timeout 2',
      'A example.com @ 192.0.2.1 (udp) -> answer: 203.0.113.10',
    ]);
  });

  it('resolves an NS name whose glue the address cap cut short', async () => {
    // One out-of-zone NS name with five glue addresses; the first four (the
    // cap) are dead, so only resolving the name reaches the healthy fifth.
    const glue = ['8.8.8.1', '8.8.8.2', '8.8.8.3', '8.8.8.4', '9.9.9.9'];
    const records = (name: string, addresses: string[]) =>
      addresses.map((data) => ({ name, type: 'A' as const, ttl: 300, data }));
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (glue.slice(0, 4).includes(nameserver)) throw new Error('timeout');
        if (nameserver !== '192.0.2.1' || domain === 'ns.example.net')
          return {
            ...response(
              domain,
              recordType,
              'NOERROR',
              records(
                domain,
                nameserver === '9.9.9.9' ? ['203.0.113.10'] : glue,
              ),
            ),
            flag_aa: true,
          } as DecodedPacket;
        return {
          ...response(domain, recordType, 'NOERROR'),
          authorities: [
            {
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data: 'ns.example.net',
            },
          ],
          additionals: records('ns.example.net', glue),
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
  });

  it('resolves an NS name whose glue the deadline cut short', async () => {
    // ns.example.net's first glue address is dead and the spent deadline
    // skips the second, so the fallback must not count that one as tried.
    const glue = ['8.8.8.1', '8.8.8.2'];
    const records = (name: string, addresses: string[]) =>
      addresses.map((data) => ({ name, type: 'A' as const, ttl: 300, data }));
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '8.8.8.1') throw new Error('timeout');
        if (nameserver === '8.8.8.2' || domain === 'ns.example.net')
          return {
            ...response(
              domain,
              recordType,
              'NOERROR',
              records(
                domain,
                nameserver === '8.8.8.2' ? ['203.0.113.10'] : glue,
              ),
            ),
            flag_aa: true,
          } as DecodedPacket;
        return {
          ...response(domain, recordType, 'NOERROR'),
          authorities: [
            {
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data: 'ns.example.net',
            },
          ],
          additionals: records('ns.example.net', glue),
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
      fallbackDeadlineMs: 0,
    });

    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
  });

  it('resolves an NS name whose glue is stale', async () => {
    // The referral's only glue for ns.example.net is a dead old address;
    // the name itself now resolves to a healthy one.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '8.8.8.8') throw new Error('timeout');
        if (nameserver === '9.9.9.9' || domain === 'ns.example.net')
          return {
            ...response(domain, recordType, 'NOERROR', [
              {
                name: domain,
                type: 'A',
                ttl: 300,
                data: nameserver === '9.9.9.9' ? '203.0.113.10' : '9.9.9.9',
              },
            ]),
            flag_aa: true,
          } as DecodedPacket;
        return {
          ...response(domain, recordType, 'NOERROR'),
          authorities: [
            {
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data: 'ns.example.net',
            },
          ],
          additionals: [
            { name: 'ns.example.net', type: 'A', ttl: 300, data: '8.8.8.8' },
          ],
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
  });

  it('resolves untried NS names before ones whose glue failed', async () => {
    // Four glued names, all dead, come first; only the fifth, unglued name
    // is healthy, and the fallback resolves at most four names.
    const dead = [1, 2, 3, 4].map((i) => `ns${i}.dead.test`);
    const ip = (name: string) =>
      name.startsWith('healthy.') ? '9.9.9.9' : `8.8.8.${name[2]}`;
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver.startsWith('8.8.8.')) throw new Error('timeout');
        if (
          nameserver === '9.9.9.9' ||
          /\.(dead\.test|example\.org)$/.test(domain)
        )
          return {
            ...response(domain, recordType, 'NOERROR', [
              {
                name: domain,
                type: 'A',
                ttl: 300,
                data: nameserver === '9.9.9.9' ? '203.0.113.10' : ip(domain),
              },
            ]),
            flag_aa: true,
          } as DecodedPacket;
        return {
          ...response(domain, recordType, 'NOERROR'),
          authorities: [...dead, 'healthy.example.org'].map((data) => ({
            name: 'example.com',
            type: 'NS',
            ttl: 300,
            data,
          })),
          additionals: dead.map((name) => ({
            name,
            type: 'A',
            ttl: 300,
            data: ip(name),
          })),
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
  });

  it('skips unglued NS names inside the zone they serve', async () => {
    // Resolving ns2.example.com needs example.com's own (dead) servers, so
    // the fallback must not loop on it; the walk moves on to the sibling.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '8.8.8.8') throw new Error('timeout');
        if (nameserver === '192.0.2.1')
          return {
            ...response(domain, recordType, 'NOERROR'),
            authorities: ['ns.example.com', 'ns2.example.com'].map((data) => ({
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data,
            })),
            additionals: [
              { name: 'ns.example.com', type: 'A', ttl: 300, data: '8.8.8.8' },
            ],
          } as DecodedPacket;
        return domain === 'www.example.com'
          ? ({
              ...response(domain, recordType, 'NOERROR', [
                { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
              ]),
              flag_aa: true,
            } as DecodedPacket)
          : response(domain, recordType, 'REFUSED');
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1', '192.0.2.2'],
    });

    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
    expect(udpTransport).not.toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'ns2.example.com' }),
    );
  });

  it('drops a dead delegation whose NS names were all glued', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '8.8.8.8') throw new Error('timeout');
        return {
          ...response(domain, recordType, 'NOERROR'),
          authorities: [
            {
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data: 'ns.example.com',
            },
          ],
          additionals: [
            { name: 'ns.example.com', type: 'A', ttl: 300, data: '8.8.8.8' },
          ],
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).rejects.toThrow();
    udpTransport.mockClear();
    await expect(
      resolver.resolveRecordType('mail.example.com', 'A'),
    ).rejects.toThrow();
    // A cached dead delegation would be tried before the root.
    expect(udpTransport.mock.calls[0]?.[0].nameserver).toBe('192.0.2.1');
  });

  it('keeps a concurrent walk from dropping a delegation it did not cache', async () => {
    // Both walks get the same referral; the A walk caches it first. Its
    // server times out on TXT only, and that failure must not evict the
    // entry the A walk wrote.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '8.8.8.8') {
          if (recordType === 'TXT') throw new Error('timeout');
          return {
            ...response(domain, recordType, 'NOERROR', [
              { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
            ]),
            flag_aa: true,
          } as DecodedPacket;
        }
        return {
          ...response(domain, recordType, 'NOERROR'),
          authorities: [
            {
              name: 'example.com',
              type: 'NS',
              ttl: 300,
              data: 'ns.example.com',
            },
          ],
          additionals: [
            { name: 'ns.example.com', type: 'A', ttl: 300, data: '8.8.8.8' },
          ],
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await resolver.resolveRecordTypes('www.example.com', ['A', 'TXT']);
    udpTransport.mockClear();
    await resolver.resolveRecordType('mail.example.com', 'A');
    expect(udpTransport.mock.calls[0]?.[0].nameserver).toBe('8.8.8.8');
  });

  it('keeps a concurrent walk from replacing a delegation it did not cache', async () => {
    // Glueless twin of the test above: the A walk caches the fast NS, and
    // the TXT walk's late-sibling retry must not swap in the slow one.
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        const answer = (data: string) =>
          ({
            ...response(domain, recordType, 'NOERROR', [
              { name: domain, type: 'A', ttl: 300, data },
            ]),
            flag_aa: true,
          }) as DecodedPacket;
        if (domain === 'ns-fast.example.net') return answer('8.8.8.8');
        if (domain === 'ns-slow.example.net') {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return answer('9.9.9.9');
        }
        if (nameserver === '192.0.2.1')
          return {
            ...response(domain, recordType, 'NOERROR'),
            authorities: ['ns-fast.example.net', 'ns-slow.example.net'].map(
              (data) => ({ name: 'example.com', type: 'NS', ttl: 300, data }),
            ),
          } as DecodedPacket;
        if (recordType === 'TXT') throw new Error('timeout');
        return answer('203.0.113.10');
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await resolver.resolveRecordTypes('www.example.com', ['A', 'TXT']);
    udpTransport.mockClear();
    await resolver.resolveRecordType('mail.example.com', 'A');
    expect(udpTransport.mock.calls[0]?.[0].nameserver).toBe('8.8.8.8');
  });

  it('rejects a referral that points back up before using its glue', async () => {
    // example.com's server refers back up to "com" with dead glue plus an
    // unglued NS. The upward referral is rejected before any glue fallback,
    // so the dead glue is never contacted and a later lookup under com
    // still resolves.
    const ns = (zone: string, data: string) => ({
      name: zone,
      type: 'NS' as const,
      ttl: 300,
      data,
    });
    const a = (name: string, data: string) => ({
      name,
      type: 'A' as const,
      ttl: 300,
      data,
    });
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        const answer = (data: string) =>
          ({
            ...response(domain, recordType, 'NOERROR', [a(domain, data)]),
            flag_aa: true,
          }) as DecodedPacket;
        const refer = (records: object) =>
          ({
            ...response(domain, recordType, 'NOERROR'),
            ...records,
          }) as DecodedPacket;
        if (nameserver === '192.0.2.1')
          return refer({
            authorities: [ns('com', 'a.tld.test')],
            additionals: [a('a.tld.test', '8.8.4.4')],
          });
        if (nameserver === '8.8.4.4')
          return domain.endsWith('.example.com')
            ? refer({
                authorities: [ns('example.com', 'ns.example.com')],
                additionals: [a('ns.example.com', '8.8.1.1')],
              })
            : answer('203.0.113.20');
        if (nameserver === '8.8.1.1')
          return refer({
            authorities: [
              ns('com', 'x.glued.test'),
              ns('com', 'ns.example.org'),
            ],
            additionals: [a('x.glued.test', '8.8.9.9')],
          });
        throw new Error('timeout');
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).rejects.toBeInstanceOf(UserFacingError);
    await expect(
      resolver.resolveRecordType('shop.other.com', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.20' })],
    });
    expect(udpTransport).not.toHaveBeenCalledWith(
      expect.objectContaining({ nameserver: '8.8.9.9' }),
    );
  });

  it('keeps a glue fallback inside the zone cut it was referred to', async () => {
    // The x.y.example.com server lists its own dead glue first, then an NS
    // for y.example.com, above its cut. The fallback must not cache that
    // server for y.example.com, where it would answer for names it does
    // not own.
    const ns = (zone: string, data: string) => ({
      name: zone,
      type: 'NS' as const,
      ttl: 300,
      data,
    });
    const a = (name: string, data: string) => ({
      name,
      type: 'A' as const,
      ttl: 300,
      data,
    });
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        const answer = (data: string) =>
          ({
            ...response(domain, recordType, 'NOERROR', [a(domain, data)]),
            flag_aa: true,
          }) as DecodedPacket;
        const refer = (records: object) =>
          ({
            ...response(domain, recordType, 'NOERROR'),
            ...records,
          }) as DecodedPacket;
        if (nameserver === '192.0.2.1')
          return domain.endsWith('.attacker.net')
            ? refer({
                authorities: [ns('attacker.net', 'ns.attacker.net')],
                additionals: [a('ns.attacker.net', '6.6.6.6')],
              })
            : refer({
                authorities: [ns('example.com', 'ns.example.com')],
                additionals: [a('ns.example.com', '8.8.8.8')],
              });
        if (nameserver === '8.8.8.8')
          return domain.endsWith('.x.y.example.com')
            ? refer({
                authorities: [ns('x.y.example.com', 'ns.x.y.example.com')],
                additionals: [a('ns.x.y.example.com', '7.7.7.7')],
              })
            : answer('203.0.113.10');
        if (nameserver === '7.7.7.7')
          return refer({
            authorities: [
              ns('www.x.y.example.com', 'dead.test'),
              ns('y.example.com', 'ns.attacker.net'),
            ],
            additionals: [a('dead.test', '9.9.9.9')],
          });
        if (nameserver === '6.6.6.6')
          return answer(
            domain === 'ns.attacker.net' ? '6.6.6.6' : '198.51.100.66',
          );
        throw new Error('timeout');
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('www.x.y.example.com', 'A'),
    ).rejects.toBeInstanceOf(UserFacingError);
    // The dead glue was tried, so the fallback ran.
    expect(udpTransport).toHaveBeenCalledWith(
      expect.objectContaining({ nameserver: '9.9.9.9' }),
    );
    await expect(
      resolver.resolveRecordType('victim.y.example.com', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
  });

  it('does not resend to the dead glued server from the glueless fallback', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '8.8.8.8') throw new Error('timeout');
        if (nameserver !== '192.0.2.1' || /^(alias|healthy)\./.test(domain)) {
          // The alias names the dead host; the healthy NS answers later.
          if (domain.startsWith('healthy.'))
            await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            ...response(domain, recordType, 'NOERROR', [
              {
                name: domain,
                type: 'A',
                ttl: 300,
                data: domain.startsWith('alias.')
                  ? '8.8.8.8'
                  : domain.startsWith('healthy.')
                    ? '9.9.9.9'
                    : '203.0.113.10',
              },
            ]),
            flag_aa: true,
          } as DecodedPacket;
        }
        return {
          ...response(domain, recordType, 'NOERROR'),
          authorities: [
            'ns.example.com',
            'alias.example.net',
            'healthy.example.org',
          ].map((data) => ({
            name: 'example.com',
            type: 'NS',
            ttl: 300,
            data,
          })),
          additionals: [
            { name: 'ns.example.com', type: 'A', ttl: 300, data: '8.8.8.8' },
          ],
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await expect(
      resolver.resolveRecordType('www.example.com', 'A'),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ data: '203.0.113.10' })],
    });
    // One load of the dead server: a first try plus three retries.
    expect(
      udpTransport.mock.calls.filter(([r]) => r.nameserver === '8.8.8.8'),
    ).toHaveLength(4);
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

describe('AuthoritativeResolver delegation cache', () => {
  const referral = (
    domain: string,
    recordType: RecordType,
    glueIp: string,
  ): DecodedPacket =>
    ({
      ...response(domain, recordType, 'NOERROR'),
      authorities: [
        { name: 'example.com', type: 'NS', ttl: 300, data: 'ns1.example.net' },
      ],
      additionals: [
        { name: 'ns1.example.net', type: 'A', ttl: 300, data: glueIp },
      ],
    }) as DecodedPacket;

  it('starts later lookups at a cached delegation instead of the root', async () => {
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) =>
        nameserver === '192.0.2.1'
          ? referral(domain, recordType, '8.8.8.8')
          : ({
              ...response(domain, recordType, 'NOERROR', [
                {
                  name: domain,
                  type: recordType,
                  ttl: 300,
                  data: recordType === 'A' ? '203.0.113.10' : '2001:db8::1',
                } as Answer,
              ]),
              flag_aa: true,
            } as DecodedPacket),
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await resolver.resolveRecordType('www.example.com', 'A');
    const result = await resolver.resolveRecordType('www.example.com', 'AAAA');

    expect(result.records[0]?.data).toBe('2001:db8::1');
    expect(
      udpTransport.mock.calls.filter(
        ([request]) => request.nameserver === '192.0.2.1',
      ),
    ).toHaveLength(1);
  });

  it('re-walks from the root when every cached delegation server fails', async () => {
    let referrals = 0;
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1') {
          referrals += 1;
          // The delegation moved between the two lookups: the re-walk finds
          // a different (healthy) nameserver.
          return referral(
            domain,
            recordType,
            referrals === 1 ? '8.8.8.8' : '9.9.9.9',
          );
        }
        if (nameserver === '8.8.8.8') {
          return recordType === 'A'
            ? ({
                ...response(domain, recordType, 'NOERROR', [
                  { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
                ]),
                flag_aa: true,
              } as DecodedPacket)
            : response(domain, recordType, 'SERVFAIL');
        }
        return {
          ...response(domain, recordType, 'NOERROR', [
            { name: domain, type: 'AAAA', ttl: 300, data: '2001:db8::1' },
          ]),
          flag_aa: true,
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await resolver.resolveRecordType('www.example.com', 'A');
    const result = await resolver.resolveRecordType('www.example.com', 'AAAA');

    expect(result.records[0]?.data).toBe('2001:db8::1');
    expect(referrals).toBe(2);
  });

  it('re-walks past a cached server that answers without authority', async () => {
    // A cached delegation whose server has gone non-authoritative (a moved
    // delegation, or a shared recursor that still answers) must not have its
    // stale, non-AA answer adopted -- the fresh root walk finds the healthy
    // server, and that must win over the deferred lastResort answer.
    let rootReferrals = 0;
    const udpTransport = vi.fn<AuthoritativeUdpTransport>(
      async ({ domain, recordType, nameserver }) => {
        if (nameserver === '192.0.2.1') {
          rootReferrals += 1;
          const [nsName, glue] =
            rootReferrals === 1
              ? ['ns1.example.net', '8.8.8.8']
              : ['ns2.example.net', '9.9.9.9'];
          return {
            ...response(domain, recordType, 'NOERROR'),
            authorities: [
              { name: 'example.com', type: 'NS', ttl: 300, data: nsName },
            ],
            additionals: [{ name: nsName, type: 'A', ttl: 300, data: glue }],
          } as DecodedPacket;
        }
        if (nameserver === '8.8.8.8') {
          return recordType === 'A'
            ? ({
                ...response(domain, recordType, 'NOERROR', [
                  { name: domain, type: 'A', ttl: 300, data: '203.0.113.10' },
                ]),
                flag_aa: true,
              } as DecodedPacket)
            : // Non-authoritative, stale MX -- deferred as lastResort.
              response(domain, recordType, 'NOERROR', [
                {
                  name: domain,
                  type: 'MX',
                  ttl: 300,
                  data: { preference: 10, exchange: 'stale.example.com' },
                },
              ]);
        }
        // 9.9.9.9: the current authoritative server the re-walk discovers.
        return {
          ...response(domain, recordType, 'NOERROR', [
            {
              name: domain,
              type: 'MX',
              ttl: 300,
              data: { preference: 20, exchange: 'fresh.example.com' },
            },
          ]),
          flag_aa: true,
        } as DecodedPacket;
      },
    );
    const resolver = new AuthoritativeResolver({
      udpTransport,
      rootServers: async () => ['192.0.2.1'],
    });

    await resolver.resolveRecordType('www.example.com', 'A');
    const result = await resolver.resolveRecordType('www.example.com', 'MX');

    expect(result.records[0]?.data).toBe('20 fresh.example.com');
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
