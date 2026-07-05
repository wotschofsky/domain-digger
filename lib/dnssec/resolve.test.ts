import type { DnskeyData, RrsigData } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import { UserFacingError } from '@/lib/user-facing-error';

import { type DnssecQuery, resolveDnssecChain } from './resolve';
import { genKey } from './test-helpers';
import { ROOT_DNSKEY_RRSIG, ROOT_DNSKEYS, ROOT_NOW } from './test-vectors';

type FakeZone = {
  keys?: DnskeyData[];
  keyRrsigs?: RrsigData[];
  rcode?: string;
};

// A validly-signed root (from the golden vectors), so chains anchor for real.
const SIGNED_ROOT: FakeZone = {
  keys: ROOT_DNSKEYS,
  keyRrsigs: [ROOT_DNSKEY_RRSIG],
};

/** Fake transport: names not listed answer empty (NODATA), like real DNS. */
const queryFrom =
  (zones: Record<string, FakeZone>): DnssecQuery =>
  async (name, type) => {
    const zone = zones[name];
    if (!zone) return { answers: [] };
    if (zone.rcode) return { answers: [], rcode: zone.rcode };
    if (type === 'DNSKEY') {
      return {
        answers: (zone.keys ?? []).map((data) => ({
          name,
          type: 'DNSKEY',
          data,
        })),
        coveringRrsigs: zone.keyRrsigs,
      };
    }
    return { answers: [] };
  };

describe('resolveDnssecChain', () => {
  it('returns null when the queried name is NXDOMAIN', async () => {
    const query = queryFrom({
      '.': SIGNED_ROOT,
      'nope.example.com': { rcode: 'NXDOMAIN' },
    });
    expect(
      await resolveDnssecChain('nope.example.com', query, ROOT_NOW),
    ).toBeNull();
  });

  it('fails loudly when the root zone serves no DNSKEY (intercepted DNS)', async () => {
    await expect(
      resolveDnssecChain('example.com', queryFrom({}), ROOT_NOW),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it('renders an unsigned domain as insecure below a secure root', async () => {
    const query = queryFrom({ '.': SIGNED_ROOT });
    const chain = await resolveDnssecChain('example.com', query, ROOT_NOW);

    // 'com' serves no keys/DS in this fake and is not the registered domain,
    // so it is dropped; the registered domain is always kept.
    expect(chain?.zones.map((z) => z.name)).toEqual(['.', 'example.com']);
    expect(chain?.zones[0].status).toBe('secure');
    expect(chain?.zones[1].status).toBe('insecure');
    expect(chain?.overall).toBe('insecure');
  });

  it('keeps deeper labels that are zone cuts and drops plain subdomains', async () => {
    const query = queryFrom({
      '.': SIGNED_ROOT,
      'sub.example.com': { keys: [genKey(13).dnskey] },
    });
    const chain = await resolveDnssecChain(
      'www.sub.example.com',
      query,
      ROOT_NOW,
    );

    // sub.example.com publishes a DNSKEY -> own zone; www.… does not -> dropped.
    expect(chain?.zones.map((z) => z.name)).toEqual([
      '.',
      'example.com',
      'sub.example.com',
    ]);
  });

  it('strips a wildcard prefix from the zone walk', async () => {
    const query = queryFrom({ '.': SIGNED_ROOT });
    const chain = await resolveDnssecChain('*.Example.COM.', query, ROOT_NOW);
    expect(chain?.zones.map((z) => z.name)).toEqual(['.', 'example.com']);
  });

  it('propagates transport failures instead of reporting a false verdict', async () => {
    const query: DnssecQuery = async (name, type) => {
      if (type === 'DS') throw new Error('socket timeout');
      return { answers: [] };
    };
    await expect(
      resolveDnssecChain('example.com', query, ROOT_NOW),
    ).rejects.toThrow('socket timeout');
  });
});
