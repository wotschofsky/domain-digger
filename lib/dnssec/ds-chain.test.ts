import { createHash } from 'node:crypto';

import type { Answer } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import { UserFacingError } from '@/lib/user-facing-error';

import {
  DsChainNameNotFoundError,
  type DsChainQuery,
  resolveDsChain,
} from './ds-chain';

// IANA root KSK public keys, used as fixed offline fixtures. The first is
// KSK-2017 (20326), the second KSK-2024 (38696).
const ROOT_KEYS = [
  'AwEAAaz/tAm8yTn4Mfeh5eyI96WSVexTBAvkMgJzkKTOiW1vkIbzxeF3+/4RgWOq7HrxRixHlFlExOLAJr5emLvN7SWXgnLh4+B5xQlNVz8Og8kvArMtNROxVQuCaSnIDdD5LKyWbRd2n9WGe2R8PzgCmr3EgVLrjyBxWezF0jLHwVN8efS3rCj/EWgvIWgb9tarpVUDK/b58Da+sqqls3eNbuv7pr+eoZG+SrDK6nWeL3c6H5Apxz7LjVc1uTIdsIXxuOLYA4/ilBmSVIzuDWfdRUfhHdY6+cn8HFRm+2hM8AnXGXws9555KrUB5qihylGa8subX2Nn6UwNR1AkUTV74bU=',
  'AwEAAa96jeuknZlaeSrvyAJj6ZHv28hhOKkx3rLGXVaC6rXTsDc449/cidltpkyGwCJNnOAlFNKF2jBosZBU5eeHspaQWOmOElZsjICMQMC3aeHbGiShvZsx4wMYSjH8e7Vrhbu6irwCzVBApESjbUdpWWmEnhathWu1jo+siFUiRAAxm9qyJNg/wOZqqzL/dL/q8PkcRU5oUKEpUge71M3ej2/7CPqpdVwuMoTvoB+ZOT4YeGyxMvHmbrxlFzGOHOijtzN+u1TQNatX2XBuzZNQ1K+s2CXkPIZo7s6JgZyvaBevYtxPvYLw4z9mR7K2vaF18UYH9Z9GNUUeayffKC73PYc=',
];

const testKey = 'AQIDBAUGBwgJCgsMDQ4PEA==';

const soa = (name: string): Answer => ({
  name,
  type: 'SOA',
  ttl: 60,
  data: {
    mname: `ns.${name}`,
    rname: `hostmaster.${name}`,
    serial: 1,
    refresh: 3600,
    retry: 600,
    expire: 86400,
    minimum: 60,
  },
});

// A delegation: the parent's NS RRset for a child zone cut.
const ns = (name: string): Answer => ({
  name,
  type: 'NS',
  ttl: 60,
  data: `ns.${name}`,
});

const host = (name: string): Answer => ({
  name,
  type: 'A',
  ttl: 60,
  data: '192.0.2.1',
});

const keyRecord = (name: string, key = testKey): Answer => ({
  name,
  type: 'DNSKEY',
  ttl: 60,
  data: { flags: 257, algorithm: 8, key: Buffer.from(key, 'base64') },
});

const keyTag = (key: string): number => {
  const rdata = Buffer.concat([
    Buffer.from([1, 1, 3, 8]),
    Buffer.from(key, 'base64'),
  ]);
  let sum = 0;
  for (const [i, octet] of rdata.entries()) {
    sum += i % 2 ? octet : octet << 8;
  }
  sum += (sum >> 16) & 0xffff;
  return sum & 0xffff;
};

const dsRecord = (
  name: string,
  key = testKey,
  digestType: 1 | 2 = 2,
  corrupt = false,
): Answer => {
  const labels = name.split('.');
  const owner = Buffer.concat([
    ...labels.flatMap((label) => [
      Buffer.from([label.length]),
      Buffer.from(label),
    ]),
    Buffer.from([0]),
  ]);
  const rdata = Buffer.concat([
    Buffer.from([1, 1, 3, 8]),
    Buffer.from(key, 'base64'),
  ]);
  const digest = createHash(digestType === 2 ? 'sha256' : 'sha1')
    .update(Buffer.concat([owner, rdata]))
    .digest();
  return {
    name,
    type: 'DS',
    ttl: 60,
    data: {
      keyTag: keyTag(key),
      algorithm: 8,
      digestType,
      digest: corrupt ? Buffer.alloc(digest.length) : digest,
    },
  };
};

// A delegated, signed zone apex whose parent publishes a matching DS.
const signedZone = (name: string, key = testKey): Answer[] => [
  ns(name),
  soa(name),
  keyRecord(name, key),
  dsRecord(name, key),
];

// Answers like AuthoritativeResolver.resolveAnswers over a small DNS tree:
// a query returns the records its name owns, a name that owns nothing but
// has descendants is an empty non-terminal (NODATA), and anything else is
// NXDOMAIN. The zone is the deepest delegation (NS owner) at or above the
// name; DS is answered from the parent side of a cut.
const dnsTree =
  (records: Answer[]): DsChainQuery =>
  async (name, type) => {
    const labels = name === '.' ? [] : name.split('.');
    const zone =
      labels
        .map((_, i) => labels.slice(i).join('.'))
        .slice(type === 'DS' ? 1 : 0)
        .find((cut) =>
          records.some((record) => record.name === cut && record.type === 'NS'),
        ) ?? '.';
    return {
      answers: records.filter(
        (record) => record.name === name && record.type === type,
      ),
      rcode:
        name === '.' ||
        records.some(
          (record) => record.name === name || record.name.endsWith(`.${name}`),
        )
          ? 'NOERROR'
          : 'NXDOMAIN',
      zone,
    };
  };

const root = (key = ROOT_KEYS[0]) => keyRecord('.', key);

describe('resolveDsChain', () => {
  it('follows matching DS digests to the full queried name', async () => {
    const query = dnsTree([
      root(),
      ...signedZone('com'),
      ...signedZone('example.com'),
      ...signedZone('www.example.com'),
    ]);
    const chain = await resolveDsChain('WWW.Example.COM.', query);
    expect(chain.verdict).toBe('intact');
    expect(chain.breakAt).toBeUndefined();
    expect(chain.name).toBe('www.example.com');
    expect(chain.zones.map((zone) => zone.name)).toEqual([
      '.',
      'com',
      'example.com',
      'www.example.com',
    ]);
    expect(chain.zones.every((zone) => zone.status === 'intact')).toBe(true);
  });

  it('keeps a host inside its signed zone instead of calling it unsigned', async () => {
    const chain = await resolveDsChain(
      'www.example.com',
      dnsTree([
        root(),
        ...signedZone('com'),
        ...signedZone('example.com'),
        host('www.example.com'),
      ]),
    );
    expect(chain.verdict).toBe('intact');
    expect(chain.breakAt).toBeUndefined();
    expect(chain.name).toBe('www.example.com');
    expect(chain.zones.map((zone) => zone.name)).toEqual([
      '.',
      'com',
      'example.com',
    ]);
  });

  it('skips empty non-terminals between zone apexes', async () => {
    const chain = await resolveDsChain(
      'a.b.example.com',
      dnsTree([
        root(),
        ...signedZone('com'),
        ...signedZone('example.com'),
        ...signedZone('a.b.example.com'),
      ]),
    );
    expect(chain.verdict).toBe('intact');
    expect(chain.zones.map((zone) => zone.name)).toEqual([
      '.',
      'com',
      'example.com',
      'a.b.example.com',
    ]);
  });

  it('finds an unsigned child by its own SOA when it shares the parent servers', async () => {
    // No NS for example.com: the com servers host the child too, so the walk
    // is never referred and only the owned SOA marks the apex.
    const chain = await resolveDsChain(
      'www.example.com',
      dnsTree([
        root(),
        ...signedZone('com'),
        soa('example.com'),
        host('www.example.com'),
      ]),
    );
    expect(chain.verdict).toBe('unsigned');
    expect(chain.breakAt).toBe('example.com');
    expect(chain.zones.map((zone) => zone.name)).toEqual([
      '.',
      'com',
      'example.com',
    ]);
  });

  it('finds an unsigned delegation whose servers host no zone at the cut', async () => {
    // Like www.archives.gov: the parent delegates the name without a DS, but
    // the child servers answer from the parent's zone, so the child has no
    // SOA of its own and only the referral marks the cut.
    const chain = await resolveDsChain(
      'www.example.com',
      dnsTree([
        root(),
        ...signedZone('com'),
        ...signedZone('example.com'),
        ns('www.example.com'),
        host('www.example.com'),
      ]),
    );
    expect(chain.verdict).toBe('unsigned');
    expect(chain.breakAt).toBe('www.example.com');
    expect(chain.zones.map((zone) => zone.name)).toEqual([
      '.',
      'com',
      'example.com',
      'www.example.com',
    ]);
  });

  it('keeps a wildcard query name and covers it by its zone', async () => {
    const chain = await resolveDsChain(
      '*.example.com',
      dnsTree([root(), ...signedZone('com'), ...signedZone('example.com')]),
    );
    expect(chain.verdict).toBe('intact');
    expect(chain.name).toBe('*.example.com');
    expect(chain.zones.at(-1)?.name).toBe('example.com');
  });

  it('marks an unsigned TLD and its descendants unsigned', async () => {
    const chain = await resolveDsChain(
      'example.com',
      dnsTree([
        root(),
        soa('com'),
        keyRecord('com'),
        ...signedZone('example.com'),
      ]),
    );
    expect(chain.verdict).toBe('unsigned');
    expect(chain.breakAt).toBe('com');
    expect(chain.zones.map((zone) => zone.status)).toEqual([
      'intact',
      'unsigned',
      'unsigned',
    ]);
  });

  it('reports a published DS with no matching DNSKEY as a mismatch', async () => {
    const chain = await resolveDsChain(
      'com',
      dnsTree([
        root(),
        soa('com'),
        keyRecord('com'),
        dsRecord('com', testKey, 2, true),
      ]),
    );
    expect(chain.verdict).toBe('mismatch');
    expect(chain.breakAt).toBe('com');
    expect(chain.zones[1].dsRecords[0].matched).toBe(false);
  });

  it.each(ROOT_KEYS)('accepts each pinned IANA root KSK', async (key) => {
    const chain = await resolveDsChain('.', dnsTree([root(key)]));
    expect(chain.verdict).toBe('intact');
    expect(chain.zones[0].dsRecords.filter((ds) => ds.matched)).toHaveLength(1);
  });

  it('throws a retryable error when root DNSKEYs are empty', async () => {
    await expect(
      resolveDsChain('example.com', dnsTree([])),
    ).rejects.toMatchObject({
      payload: { retryable: true },
    });
  });

  it('treats NXDOMAIN at the queried name as not found', async () => {
    await expect(
      resolveDsChain(
        'missing.example.com',
        dnsTree([root(), ...signedZone('com'), ...signedZone('example.com')]),
      ),
    ).rejects.toBeInstanceOf(DsChainNameNotFoundError);
  });

  it('rejects names over 16 labels before querying', async () => {
    let queried = false;
    await expect(
      resolveDsChain(
        Array.from({ length: 17 }, () => 'a').join('.'),
        async () => {
          queried = true;
          return { answers: [], zone: '.' };
        },
      ),
    ).rejects.toBeInstanceOf(UserFacingError);
    expect(queried).toBe(false);
  });

  it('prefers SHA-256 when SHA-1 and SHA-256 DS records coexist', async () => {
    const records = [root(), soa('com'), keyRecord('com'), dsRecord('com')];
    const chain = await resolveDsChain(
      'com',
      dnsTree([...records, dsRecord('com', testKey, 1, true)]),
    );
    expect(chain.verdict).toBe('intact');
    expect(chain.zones[1].dsRecords).toEqual([
      expect.objectContaining({
        digestType: 2,
        matched: true,
        weakDigest: false,
      }),
      expect.objectContaining({
        digestType: 1,
        matched: false,
        weakDigest: true,
      }),
    ]);

    const reverse = await resolveDsChain(
      'com',
      dnsTree([
        root(),
        soa('com'),
        keyRecord('com'),
        dsRecord('com', testKey, 1),
        dsRecord('com', testKey, 2, true),
      ]),
    );
    expect(reverse.verdict).toBe('mismatch');
  });
});
