import type { Answer } from 'dns-packet';
import { describe, expect, it, vi } from 'vitest';

import { UserFacingError } from '@/lib/user-facing-error';

import { dsDigest } from './ds';
import {
  DsChainNameNotFoundError,
  type DsChainQuery,
  resolveDsChain,
  resolveDsChainWithin,
} from './ds-chain';
import { genKey, signDnskeyRrset } from './test-helpers';
import { ROOT_DNSKEY_RRSIG, ROOT_DNSKEYS, ROOT_NOW } from './test-vectors';
import { dnskeyKeyTag } from './wire';

// Every walk is judged at ROOT_NOW, inside the captured root signature's
// validity window. Zones below the root sign with one generated key.
const NOW = ROOT_NOW;
const DAY = 86_400;
const WINDOW = { inception: NOW - DAY, expiration: NOW + DAY };
type Signer = ReturnType<typeof genKey>;
const KSK = genKey(13);

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

const keyRecord = (name: string, key = KSK.dnskey): Answer => ({
  name,
  type: 'DNSKEY',
  ttl: 60,
  data: key,
});

// The RRSIG over a zone's DNSKEY RRset `keys`, made by `signer`.
const keySig = (
  name: string,
  keys = [KSK.dnskey],
  signer: Signer = KSK,
  window = WINDOW,
): Answer => ({
  name,
  type: 'RRSIG',
  ttl: 60,
  data: signDnskeyRrset(name, keys, signer, window),
});

const dsRecord = (
  name: string,
  key = KSK.dnskey,
  digestType = 2,
  corrupt = false,
): Answer => {
  // Digest types without a hash here (e.g. 3, GOST) get a SHA-256 stand-in.
  const digest = dsDigest(name, key, digestType) ?? dsDigest(name, key, 2)!;
  return {
    name,
    type: 'DS',
    ttl: 60,
    data: {
      keyTag: dnskeyKeyTag(key),
      algorithm: key.algorithm,
      digestType,
      digest: corrupt ? Buffer.alloc(digest.length) : digest,
    },
  };
};

// A delegated, signed zone apex whose parent publishes a matching DS.
const signedZone = (name: string): Answer[] => [
  ns(name),
  soa(name),
  keyRecord(name),
  dsRecord(name),
  keySig(name),
];

// com with its own SOA and validly signed KSK, under the parent DS `ds`.
const com = (...ds: Answer[]): Answer[] =>
  [root(), soa('com'), keyRecord('com'), keySig('com'), ...ds].flat();

// Answers like AuthoritativeResolver.resolveAnswers over a small DNS tree:
// a query returns the records its name owns, a name that owns nothing but
// has descendants is an empty non-terminal (NODATA), and anything else is
// NXDOMAIN. The zone is the deepest delegation (NS owner) at or above the
// name; DS is answered from the parent side of a cut. Cuts reach onZoneCut before their servers
// are asked, so a `down` zone still counts as a cut while its servers hang or refuse.
const dnsTree =
  (
    records: Answer[],
    down: Record<string, 'hang' | 'refuse'> = {},
  ): DsChainQuery =>
  async (name, type, onZoneCut) => {
    const labels = name === '.' ? [] : name.split('.');

    const cuts = labels
      .map((_, i) => labels.slice(i).join('.'))
      .slice(type === 'DS' ? 1 : 0)
      .filter((cut) =>
        records.some((record) => record.name === cut && record.type === 'NS'),
      );

    const zone = cuts[0] ?? '.';
    cuts.toReversed().forEach((cut) => onZoneCut?.(cut));

    if (down[zone] === 'hang') return new Promise(() => {});
    if (down[zone] === 'refuse') {
      throw new Error(`All nameservers failed for ${name} ${type}: REFUSED`);
    }

    return {
      answers: records.filter(
        (record) => record.name === name && record.type === type,
      ),
      coveringRrsigs: records.flatMap((record) =>
        record.name === name &&
        record.type === 'RRSIG' &&
        record.data.typeCovered === type
          ? [record.data]
          : [],
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

// The real root DNSKEY RRset, both IANA KSKs included, and its RRSIG.
const root = (): Answer[] => [
  ...ROOT_DNSKEYS.map((key) => keyRecord('.', key)),
  { name: '.', type: 'RRSIG', ttl: 60, data: ROOT_DNSKEY_RRSIG },
];

const walk = (name: string, records: (Answer | Answer[])[]) =>
  resolveDsChain(name, dnsTree(records.flat()), NOW);

describe('resolveDsChain', () => {
  it('follows matching DS digests to the full queried name', async () => {
    const chain = await walk('WWW.Example.COM.', [
      root(),
      signedZone('com'),
      signedZone('example.com'),
      signedZone('www.example.com'),
    ]);
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
    expect(chain.zones.map((zone) => zone.keySignature?.outcome)).toEqual([
      'valid',
      'valid',
      'valid',
      'valid',
    ]);
    expect(chain.zones[1].keySignature).toMatchObject({
      expiration: WINDOW.expiration,
    });
  });

  it('keeps a host inside its signed zone instead of calling it unsigned', async () => {
    const chain = await walk('www.example.com', [
      root(),
      signedZone('com'),
      signedZone('example.com'),
      host('www.example.com'),
    ]);
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
    const chain = await walk('a.b.example.com', [
      root(),
      signedZone('com'),
      signedZone('example.com'),
      signedZone('a.b.example.com'),
    ]);
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
    const chain = await walk('www.example.com', [
      root(),
      signedZone('com'),
      soa('example.com'),
      host('www.example.com'),
    ]);
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
    const chain = await walk('www.example.com', [
      root(),
      signedZone('com'),
      signedZone('example.com'),
      ns('www.example.com'),
      host('www.example.com'),
    ]);
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
    const chain = await walk('*.example.com', [
      root(),
      signedZone('com'),
      signedZone('example.com'),
    ]);
    expect(chain.verdict).toBe('intact');
    expect(chain.name).toBe('*.example.com');
    expect(chain.zones.at(-1)?.name).toBe('example.com');
  });

  it('stops at an unsigned TLD: nothing below it can be secure', async () => {
    const chain = await walk('example.com', [com(), signedZone('example.com')]);
    expect(chain.verdict).toBe('unsigned');
    expect(chain.breakAt).toBe('com');
    expect(chain.zones.map((zone) => zone.status)).toEqual([
      'intact',
      'unsigned',
    ]);
  });

  it('reports a published DS with no matching DNSKEY as a mismatch', async () => {
    const chain = await walk('com', com(dsRecord('com', KSK.dnskey, 2, true)));
    expect(chain.verdict).toBe('mismatch');
    expect(chain.breakAt).toBe('com');
    expect(chain.zones[1].dsRecords[0].matched).toBe(false);
  });

  it('links both pinned IANA root KSKs and verifies the root key set', async () => {
    const chain = await walk('.', root());
    expect(chain.verdict).toBe('intact');
    expect(chain.zones[0].dsRecords.map((ds) => ds.matched)).toEqual([
      true,
      true,
    ]);
    expect(chain.zones[0].keySignature?.outcome).toBe('valid');
  });

  it('throws a retryable error when root DNSKEYs are empty', async () => {
    await expect(walk('example.com', [])).rejects.toMatchObject({
      payload: { retryable: true },
    });
  });

  it('treats NXDOMAIN at the queried name as not found', async () => {
    await expect(
      walk('missing.example.com', [
        root(),
        signedZone('com'),
        signedZone('example.com'),
      ]),
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
    const chain = await walk(
      'com',
      com(dsRecord('com'), dsRecord('com', KSK.dnskey, 1, true)),
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

    const reverse = await walk(
      'com',
      com(dsRecord('com', KSK.dnskey, 1), dsRecord('com', KSK.dnskey, 2, true)),
    );
    expect(reverse.verdict).toBe('mismatch');
  });

  it('does not treat a DNSKEY owned by a host as a zone cut', async () => {
    const chain = await walk('www.example.com', [
      root(),
      signedZone('com'),
      signedZone('example.com'),
      keyRecord('www.example.com'),
    ]);
    expect(chain.verdict).toBe('intact');
    expect(chain.zones.at(-1)?.name).toBe('example.com');
  });

  it('breaks on an expired DNSKEY signature and stops there', async () => {
    const expired = { inception: NOW - 2 * DAY, expiration: NOW - DAY };
    const chain = await walk('www.example.com', [
      root(),
      signedZone('com'),
      ns('example.com'),
      soa('example.com'),
      keyRecord('example.com'),
      dsRecord('example.com'),
      keySig('example.com', [KSK.dnskey], KSK, expired),
      signedZone('www.example.com'),
    ]);
    expect(chain.verdict).toBe('bad-signature');
    expect(chain.breakAt).toBe('example.com');
    expect(chain.zones[2].keySignature).toEqual({
      outcome: 'expired',
      ...expired,
    });
    expect(chain.zones).toHaveLength(3);
  });

  it('judges each signature when it is checked, not when the walk started', async () => {
    // Only Date is faked, so the walk's own awaits still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(NOW * 1000);
      const tree = dnsTree([root(), signedZone('com')].flat());
      const chain = await resolveDsChain('com', async (name, type) => {
        // com's key-set signature expires while the walk is under way.
        if (name === 'com') vi.setSystemTime((WINDOW.expiration + 1) * 1000);
        return tree(name, type);
      });
      expect(chain.zones[0].keySignature?.outcome).toBe('valid');
      expect(chain.zones[1].keySignature?.outcome).toBe('expired');
    } finally {
      vi.useRealTimers();
    }
  });

  it('breaks when the DNSKEY RRSIG is missing', async () => {
    const chain = await walk('com', [
      root(),
      soa('com'),
      keyRecord('com'),
      dsRecord('com'),
    ]);
    expect(chain.verdict).toBe('bad-signature');
    expect(chain.zones[1].keySignature).toEqual({ outcome: 'missing' });
  });

  it('breaks when only a key no DS links signed the key set', async () => {
    const zsk = genKey(13);
    const keys = [KSK.dnskey, zsk.dnskey];
    const chain = await walk(
      'com',
      [
        root(),
        soa('com'),
        keys.map((key) => keyRecord('com', key)),
        dsRecord('com'),
        keySig('com', keys, zsk),
      ].flat(),
    );
    expect(chain.verdict).toBe('bad-signature');
    expect(chain.zones[1].keySignature?.outcome).toBe('unauthenticated-signer');
  });

  it('breaks when the served key set is not the one that was signed', async () => {
    const extra = genKey(13).dnskey;
    const chain = await walk('com', [
      com(dsRecord('com')),
      keyRecord('com', extra),
    ]);
    expect(chain.verdict).toBe('bad-signature');
    expect(chain.zones[1].keySignature?.outcome).toBe('invalid');
  });

  it('stops at an unsigned break instead of waiting on a hanging zone below it', async () => {
    // Like *.mail.protection.outlook.com, whose servers FORMERR every DNSSEC query.
    const chain = await resolveDsChain(
      'host.mail.protection.example.com',
      dnsTree(
        [
          root(),
          signedZone('com'),
          signedZone('example.com'),
          ns('protection.example.com'),
          soa('protection.example.com'),
          ns('mail.protection.example.com'),
          host('host.mail.protection.example.com'),
        ].flat(),
        { 'mail.protection.example.com': 'hang' },
      ),
      NOW,
    );

    expect(chain.verdict).toBe('unsigned');
    expect(chain.breakAt).toBe('protection.example.com');
    expect(chain.zones.map((zone) => zone.name)).toEqual([
      '.',
      'com',
      'example.com',
      'protection.example.com',
    ]);
  });

  it('calls a lame delegation without DS unsigned and its keys unreachable', async () => {
    const chain = await resolveDsChain(
      'example.com',
      dnsTree([root(), signedZone('com'), ns('example.com')].flat(), {
        'example.com': 'refuse',
      }),
      NOW,
    );

    expect(chain.verdict).toBe('unsigned');
    expect(chain.breakAt).toBe('example.com');

    expect(chain.zones.at(-1)).toMatchObject({
      name: 'example.com',
      status: 'unsigned',
      keys: undefined,
    });
  });

  it('gives up on the keys of a hanging delegation without DS, not on its verdict', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    try {
      const settled = resolveDsChain(
        'www.example.com',
        dnsTree([root(), signedZone('com'), ns('example.com')].flat(), {
          'example.com': 'hang',
        }),
        NOW,
      );

      await vi.advanceTimersByTimeAsync(5000);
      const chain = await settled;

      expect(chain.verdict).toBe('unsigned');
      expect(chain.breakAt).toBe('example.com');
      expect(chain.zones.at(-1)?.keys).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits out a slow empty non-terminal without DS, so the signed zone below still counts', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    try {
      const tree = dnsTree(
        [
          root(),
          signedZone('com'),
          signedZone('example.com'),
          signedZone('a.b.example.com'),
        ].flat(),
      );

      const settled = resolveDsChain(
        'a.b.example.com',
        async (name, type, onZoneCut) => {
          if (name === 'b.example.com' && type !== 'DS') {
            await new Promise((resolve) => setTimeout(resolve, 30_000));
          }

          return tree(name, type, onZoneCut);
        },
        NOW,
      );

      await vi.advanceTimersByTimeAsync(30_000);
      const chain = await settled;

      expect(chain.verdict).toBe('intact');
      expect(chain.zones.map((zone) => zone.name)).toEqual([
        '.',
        'com',
        'example.com',
        'a.b.example.com',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts no further level once the deadline has passed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    try {
      const tree = dnsTree([root(), signedZone('com')].flat());
      const asked: string[] = [];

      const settled = resolveDsChainWithin(
        'com',
        async (name, type) => {
          asked.push(`${name} ${type}`);

          if (name === '.') {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          return tree(name, type);
        },
        1000,
      ).catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(2000);

      expect(await settled).toBeInstanceOf(UserFacingError);
      expect(asked).toEqual(['. DNSKEY']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('names the queries still in flight when the deadline passes', async () => {
    vi.useFakeTimers();

    try {
      const settled = resolveDsChainWithin(
        'com',
        () => new Promise(() => {}),
        1000,
      ).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(1000);
      const error = await settled;

      expect(error).toBeInstanceOf(UserFacingError);
      expect((error as Error).cause).toMatchObject({
        message: 'Still waiting after 1000ms for: . DNSKEY',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
