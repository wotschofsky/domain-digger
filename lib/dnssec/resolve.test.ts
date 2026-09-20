import type { DnskeyData, DsData, RrsigData } from 'dns-packet';
import { describe, expect, it } from 'vitest';

import type { RecordType } from '@/lib/resolvers/base';
import { UserFacingError } from '@/lib/user-facing-error';

import {
  type DnssecQuery,
  isDnameSynthesized,
  resolveDnssecChain,
} from './resolve';
import { genKey } from './test-helpers';
import { ROOT_DNSKEY_RRSIG, ROOT_DNSKEYS, ROOT_NOW } from './test-vectors';
import type { DnssecAnswerRecord } from './types';

type FakeZone = {
  keys?: DnskeyData[];
  keyRrsigs?: RrsigData[];
  ds?: DsData[];
  dsRrsigs?: RrsigData[];
  rcode?: string;
};

// A validly-signed root (from the golden vectors), so chains anchor for real.
const SIGNED_ROOT: FakeZone = {
  keys: ROOT_DNSKEYS,
  keyRrsigs: [ROOT_DNSKEY_RRSIG],
};

/**
 * Fake transport. Every listed name is a zone cut with its own servers, so a
 * query is answered by the deepest listed suffix of the queried name -- what a
 * real referral walk reports as `zone`. A name that is not a cut answers empty
 * (NODATA) from its enclosing zone, like real DNS. An entry carrying only an
 * rcode is not a cut either: NXDOMAIN comes from the zone above it.
 */
const cutFor = (name: string, zones: Record<string, FakeZone>): string => {
  const labels = name.split('.').filter(Boolean);
  for (let i = 0; i < labels.length; i++) {
    const candidate = labels.slice(i).join('.');
    if (zones[candidate] && !zones[candidate].rcode) return candidate;
  }
  return '.';
};

const queryFrom =
  (zones: Record<string, FakeZone>): DnssecQuery =>
  async (name, type) => {
    const zoneCut = cutFor(name, zones);
    const zone = zones[name];
    if (!zone) return { answers: [], zone: zoneCut };
    if (zone.rcode) return { answers: [], zone: zoneCut, rcode: zone.rcode };
    if (type === 'DNSKEY') {
      return {
        answers: (zone.keys ?? []).map((data) => ({
          name,
          type: 'DNSKEY',
          data,
        })),
        coveringRrsigs: zone.keyRrsigs,
        zone: zoneCut,
      };
    }
    if (type === 'DS') {
      return {
        answers: (zone.ds ?? []).map((data) => ({ name, type: 'DS', data })),
        coveringRrsigs: zone.dsRrsigs,
        zone: zoneCut,
      };
    }
    return { answers: [], zone: zoneCut };
  };

describe('resolveDnssecChain', () => {
  it('does not claim authenticated nonexistence from a bare NXDOMAIN rcode', async () => {
    const query = queryFrom({
      '.': SIGNED_ROOT,
      com: {},
      'nope.example.com': { rcode: 'NXDOMAIN' },
    });
    const chain = await resolveDnssecChain('nope.example.com', query, ROOT_NOW);
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
    const query = queryFrom({ '.': SIGNED_ROOT, com: {} });
    const chain = await resolveDnssecChain('example.com', query, ROOT_NOW);

    // 'com' serves no keys/DS in this fake, but it is a delegated zone cut of
    // its own, so it keeps its own link rather than being collapsed away.
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
      com: {},
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

  it('keeps an unsigned delegation above a deeper zone cut', async () => {
    // sub.example.com has its own servers but serves no keys. Dropping it
    // would graft the signed island onto example.com and misvalidate its DS
    // against the wrong keys.
    const query = queryFrom({
      '.': SIGNED_ROOT,
      com: {},
      'sub.example.com': {},
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

  it('drops an empty non-terminal that no server is delegated for', async () => {
    // deep.sub.example.com is delegated directly from example.com; the
    // sub.example.com label is an empty non-terminal, not an unsigned cut --
    // no servers answer for it -- and keeping it would break the valid chain
    // with a false insecure.
    const query = queryFrom({
      '.': SIGNED_ROOT,
      com: {},
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
      'deep.sub.example.com',
    ]);
  });

  it('rejects domains with too many labels instead of walking them all', async () => {
    const deep = `${'a.'.repeat(20)}example.com`;
    await expect(
      resolveDnssecChain(deep, queryFrom({ '.': SIGNED_ROOT }), ROOT_NOW),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it('strips a wildcard prefix from the zone walk', async () => {
    const query = queryFrom({ '.': SIGNED_ROOT, com: {} });
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
      return { answers: [], zone: '.' };
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

  it('reports the chain-only verdict when no leaf probe runs', async () => {
    const query = queryFrom({ '.': SIGNED_ROOT, com: {} });
    const chain = await resolveDnssecChain('example.com', query, ROOT_NOW);

    expect(chain.verdict).toEqual({ kind: 'unsigned-cut', atLeaf: false });
    expect(chain.breakAt).toBe(1);
    expect(chain.zones.map((z) => z.inherited)).toEqual([false, false, true]);
    // The leaf never validated, so nothing was probed.
    expect(chain.coverage.checkedPositiveRrsetTypes).toEqual([]);
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

/**
 * The leaf RRset probes only run once the chain authenticates down to the
 * queried name. The signed root is the only zone these tests can anchor for
 * real -- the IANA anchors are fixed and we do not hold the private half -- so
 * the root doubles as the queried leaf. That exercises the orchestration
 * (which types are probed, how their answers become one observation, what a
 * failed probe means); the signature checking itself is covered against real
 * keys in rrset.test.ts.
 */
describe('resolveDnssecChain leaf probes', () => {
  type ProbeAnswer = DnssecAnswerRecord[] | 'throw' | 'nxdomain';

  const rootLeafQuery =
    (answers: Partial<Record<RecordType, ProbeAnswer>>): DnssecQuery =>
    async (name, type) => {
      if (type === 'DNSKEY') {
        return {
          answers: ROOT_DNSKEYS.map((data) => ({
            name: '.',
            type: 'DNSKEY',
            data,
          })),
          coveringRrsigs: [ROOT_DNSKEY_RRSIG],
          zone: '.',
        };
      }
      const answer = answers[type];
      if (answer === 'throw') throw new Error('socket timeout');
      if (answer === 'nxdomain') {
        return { answers: [], zone: '.', rcode: 'NXDOMAIN' };
      }
      return { answers: answer ?? [], zone: '.' };
    };

  const record = (type: string, data: unknown): DnssecAnswerRecord => ({
    name: '.',
    type,
    data,
  });

  it('probes the common types and flags records served without an RRSIG', async () => {
    const chain = await resolveDnssecChain(
      '.',
      rootLeafQuery({ TXT: [record('TXT', ['hello'])] }),
      ROOT_NOW,
    );

    expect(chain.status).toBe('secure');
    expect(chain.coverage.checkedPositiveRrsetTypes).toEqual([
      'SOA',
      'A',
      'AAAA',
      'NS',
      'MX',
      'TXT',
      'CAA',
      'SRV',
      'NAPTR',
      'CNAME',
    ]);
    expect(chain.query.observation).toBe('positive');
    const txt = chain.zones[0].rrsets?.find((rrset) => rrset.type === 'TXT');
    expect(txt?.reason).toBe('missing-rrsig');
    expect(txt?.status).toBe('unsigned');
    expect(chain.verdict).toEqual({
      kind: 'secure-rrset-problems',
      rrsetTypes: ['TXT'],
    });
  });

  it('reports an unproved NODATA when every probe answers empty', async () => {
    const chain = await resolveDnssecChain('.', rootLeafQuery({}), ROOT_NOW);

    expect(chain.query.observation).toBe('unproved-nodata');
    expect(chain.verdict).toEqual({ kind: 'secure-nodata' });
    // Absent RRsets stay in the model so "not present" is distinguishable
    // from "not checked", but none of them is a problem.
    expect(
      chain.zones[0].rrsets?.every((rrset) => rrset.status === 'absent'),
    ).toBe(true);
  });

  it('reports an unproved NXDOMAIN when a probe says the name does not exist', async () => {
    const chain = await resolveDnssecChain(
      '.',
      rootLeafQuery({ SOA: 'nxdomain' }),
      ROOT_NOW,
    );

    expect(chain.query.observation).toBe('unproved-nxdomain');
    expect(chain.verdict).toEqual({ kind: 'nxdomain-unproved' });
  });

  it('lets a positive answer outrank another probe’s NXDOMAIN', async () => {
    const chain = await resolveDnssecChain(
      '.',
      rootLeafQuery({ SOA: 'nxdomain', A: [record('A', '192.0.2.1')] }),
      ROOT_NOW,
    );

    expect(chain.query.observation).toBe('positive');
  });

  it('treats a failed probe as indeterminate, never as proof of absence', async () => {
    const chain = await resolveDnssecChain(
      '.',
      rootLeafQuery({ MX: 'throw' }),
      ROOT_NOW,
    );

    const mx = chain.zones[0].rrsets?.find((rrset) => rrset.type === 'MX');
    expect(mx?.reason).toBe('lookup-failed');
    expect(chain.query.observation).toBe('indeterminate');
    expect(chain.verdict).toEqual({
      kind: 'secure-rrset-unchecked',
      rrsetTypes: ['MX'],
    });
  });

  it('surfaces the queried name’s CNAME target as the leaf alias', async () => {
    const chain = await resolveDnssecChain(
      '.',
      rootLeafQuery({ CNAME: [record('CNAME', 'Target.Example.')] }),
      ROOT_NOW,
    );

    expect(chain.leafAlias).toBe('target.example');
    const cname = chain.zones[0].rrsets?.find(
      (rrset) => rrset.type === 'CNAME',
    );
    expect(cname?.cnameTarget).toBe('target.example');
  });
});
