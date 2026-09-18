import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { RawRecord } from '@/lib/resolvers/base';
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

const keyRecord = (name: string, key = testKey): RawRecord => ({
  name,
  type: 'DNSKEY',
  TTL: 60,
  data: `257 8 ${key}`,
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
): RawRecord => {
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
    .digest('hex');
  return {
    name,
    type: 'DS',
    TTL: 60,
    data: `${keyTag(key)} 8 ${digestType} ${corrupt ? '00'.repeat(digest.length / 2) : digest}`,
  };
};

const queryFor =
  (records: RawRecord[], nxdomain?: string): DsChainQuery =>
  async (name, type) => ({
    records: records.filter(
      (record) => record.name === name && record.type === type,
    ),
    rcode: name === nxdomain ? 'NXDOMAIN' : 'NOERROR',
  });

const root = (key = ROOT_KEYS[0]) => keyRecord('.', key);

describe('resolveDsChain', () => {
  it('follows matching DS digests to the full queried name', async () => {
    const query = queryFor([
      root(),
      keyRecord('com'),
      dsRecord('com'),
      keyRecord('example.com'),
      dsRecord('example.com'),
      keyRecord('www.example.com'),
      dsRecord('www.example.com'),
    ]);
    const chain = await resolveDsChain('WWW.Example.COM.', query);
    expect(chain.verdict).toBe('intact');
    expect(chain.breakAt).toBeUndefined();
    expect(chain.zones.map((zone) => zone.name)).toEqual([
      '.',
      'com',
      'example.com',
      'www.example.com',
    ]);
    expect(chain.zones.every((zone) => zone.status === 'intact')).toBe(true);
  });

  it('marks an unsigned TLD and its descendants unsigned', async () => {
    const chain = await resolveDsChain(
      'example.com',
      queryFor([
        root(),
        keyRecord('com'),
        keyRecord('example.com'),
        dsRecord('example.com'),
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
      queryFor([root(), keyRecord('com'), dsRecord('com', testKey, 2, true)]),
    );
    expect(chain.verdict).toBe('mismatch');
    expect(chain.breakAt).toBe('com');
    expect(chain.zones[1].dsRecords[0].matched).toBe(false);
  });

  it.each(ROOT_KEYS)('accepts each pinned IANA root KSK', async (key) => {
    const chain = await resolveDsChain('.', queryFor([root(key)]));
    expect(chain.verdict).toBe('intact');
    expect(chain.zones[0].dsRecords.filter((ds) => ds.matched)).toHaveLength(1);
  });

  it('throws a retryable error when root DNSKEYs are empty', async () => {
    await expect(
      resolveDsChain('example.com', queryFor([])),
    ).rejects.toMatchObject({
      payload: { retryable: true },
    });
  });

  it('treats NXDOMAIN at the queried name as not found', async () => {
    await expect(
      resolveDsChain(
        'missing.com',
        queryFor([root(), keyRecord('com'), dsRecord('com')], 'missing.com'),
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
          return { records: [] };
        },
      ),
    ).rejects.toBeInstanceOf(UserFacingError);
    expect(queried).toBe(false);
  });

  it('prefers SHA-256 when SHA-1 and SHA-256 DS records coexist', async () => {
    const records = [root(), keyRecord('com'), dsRecord('com')];
    const chain = await resolveDsChain(
      'com',
      queryFor([...records, dsRecord('com', testKey, 1, true)]),
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
      queryFor([
        root(),
        keyRecord('com'),
        dsRecord('com', testKey, 1),
        dsRecord('com', testKey, 2, true),
      ]),
    );
    expect(reverse.verdict).toBe('mismatch');
  });
});
