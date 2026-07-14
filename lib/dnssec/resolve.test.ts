import type { DnskeyData, RrsigData } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import { UserFacingError } from '@/lib/user-facing-error';

import {
  type DnssecQuery,
  isDnameSynthesized,
  resolveDnssecChain,
} from './resolve';
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
  it('does not claim authenticated nonexistence from a bare NXDOMAIN rcode', async () => {
    const query = queryFrom({
      '.': SIGNED_ROOT,
      'nope.example.com': { rcode: 'NXDOMAIN' },
    });
    const chain = await resolveDnssecChain('nope.example.com', query, ROOT_NOW);
    expect(chain.coverage.negativeProofs).toBe('not-implemented');
    expect(chain.status).toBe('insecure');
    expect(chain.query).toEqual({
      name: 'nope.example.com',
      observation: 'unproved-nxdomain',
    });
  });

  it('fails loudly when the root zone serves no DNSKEY (intercepted DNS)', async () => {
    await expect(
      resolveDnssecChain('example.com', queryFrom({}), ROOT_NOW),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it('renders an unsigned domain as insecure below a secure root', async () => {
    const query = queryFrom({ '.': SIGNED_ROOT });
    const chain = await resolveDnssecChain('example.com', query, ROOT_NOW);

    // 'com' serves no keys/DS in this fake, but empty labels above a kept
    // zone stay: dropping them would graft the zone onto its grandparent.
    expect(chain?.zones.map((z) => z.name)).toEqual([
      '.',
      'com',
      'example.com',
    ]);
    expect(chain?.zones[0].status).toBe('secure');
    expect(chain?.zones[1].status).toBe('insecure');
    expect(chain?.zones[2].status).toBe('insecure');
    expect(chain?.status).toBe('insecure');
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
      'com',
      'example.com',
      'sub.example.com',
    ]);
  });

  it('keeps an empty intermediate label above a deeper zone cut', async () => {
    // Dropping sub.example.com would graft the signed island onto
    // example.com and misvalidate its DS against the wrong keys.
    const query = queryFrom({
      '.': SIGNED_ROOT,
      'deep.sub.example.com': { keys: [genKey(13).dnskey] },
    });
    const chain = await resolveDnssecChain(
      'deep.sub.example.com',
      query,
      ROOT_NOW,
    );

    expect(chain?.zones.map((z) => z.name)).toEqual([
      '.',
      'com',
      'example.com',
      'sub.example.com',
      'deep.sub.example.com',
    ]);
  });

  it('strips a wildcard prefix from the zone walk', async () => {
    const query = queryFrom({ '.': SIGNED_ROOT });
    const chain = await resolveDnssecChain('*.Example.COM.', query, ROOT_NOW);
    expect(chain?.zones.map((z) => z.name)).toEqual([
      '.',
      'com',
      'example.com',
    ]);
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

  it('rejects returned error rcodes instead of treating them as NODATA', async () => {
    const query = queryFrom({
      '.': SIGNED_ROOT,
      'example.com': { rcode: 'SERVFAIL' },
    });

    await expect(
      resolveDnssecChain('example.com', query, ROOT_NOW),
    ).rejects.toMatchObject({
      payload: expect.objectContaining({ retryable: true }),
    });
  });

  it('recognizes only exact DNAME substitutions as synthesized CNAMEs', () => {
    const dname = { name: 'example.com', target: 'example.net' };

    // The synthesized substitution: www.example.com -> www.example.net.
    expect(
      isDnameSynthesized('www.example.com', 'www.example.net.', [dname]),
    ).toBe(true);
    // Unrelated DNAME must not excuse an unsigned CNAME.
    expect(
      isDnameSynthesized('www.example.com', 'cdn.example.org', [
        { name: 'other.test', target: 'elsewhere.test' },
      ]),
    ).toBe(false);
    // Right DNAME, wrong target: not the substitution.
    expect(
      isDnameSynthesized('www.example.com', 'cdn.example.net', [dname]),
    ).toBe(false);
    // DNAME applies only strictly below its owner.
    expect(isDnameSynthesized('example.com', 'example.net', [dname])).toBe(
      false,
    );
  });

  it('requests DS RRsets with DNSSEC records enabled', async () => {
    const calls: Array<{ type: string; dnssecOk: boolean | undefined }> = [];
    const baseQuery = queryFrom({ '.': SIGNED_ROOT });
    const query: DnssecQuery = async (name, type, dnssecOk) => {
      calls.push({ type, dnssecOk });
      return baseQuery(name, type, dnssecOk);
    };

    await resolveDnssecChain('example.com', query, ROOT_NOW);

    expect(calls.filter((call) => call.type === 'DS')).not.toHaveLength(0);
    expect(
      calls
        .filter((call) => call.type === 'DS')
        .every((call) => call.dnssecOk === true),
    ).toBe(true);
  });
});
