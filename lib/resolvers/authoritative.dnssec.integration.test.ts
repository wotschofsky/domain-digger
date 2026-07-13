// @vitest-environment node
// Real UDP/fetch are needed here; happy-dom's polyfilled fetch breaks the
// root-server lookup, so this file opts into the Node environment.
import { describe, expect, it, vi } from 'vitest';

import type { DnssecChain } from '@/lib/dnssec';

import { UserFacingError } from '../user-facing-error';
import { AuthoritativeResolver } from './authoritative';

const assertChain = (chain: DnssecChain): DnssecChain => chain;

// --- Offline guard test (runs always, no network) ------------------------
// The root zone always serves DNSKEY. If a query path returns none (e.g. a
// captive/intercepting resolver that answers with empty NODATA responses), the
// resolver must fail loudly rather than render a false "broken" verdict. We
// simulate that by stubbing every raw lookup to an empty answer.
describe('resolveDnssecChain root guard', () => {
  it('throws (retryable) instead of a false verdict when the root DNSKEY is unreachable', async () => {
    const resolver = new AuthoritativeResolver();
    // fetchRecordsRaw is private; override it to mimic an intercepting network
    // that returns NOERROR/no-data for every query, including the root DNSKEY.
    vi.spyOn(
      resolver as unknown as {
        fetchRecordsRaw: () => Promise<{ answers: []; trace: string[] }>;
      },
      'fetchRecordsRaw',
    ).mockResolvedValue({ answers: [], trace: [] });

    await expect(resolver.resolveDnssecChain('google.com')).rejects.toThrow(
      UserFacingError,
    );
  });
});

// --- Offline delegation-cache tests (run always, no network) --------------
// The cache lets queries under an already-discovered zone cut skip the
// root re-walk; its guards (suffix-only writes, first-writer-wins, DS
// starting at the parent) are what keep it from being a poisoning vector.
describe('delegation cache', () => {
  type CacheAccess = {
    cacheDelegation: (zone: string, domain: string, ips: string[]) => void;
    cachedDelegation: (
      domain: string,
      recordType: string,
    ) => string[] | undefined;
  };
  const make = () => new AuthoritativeResolver() as unknown as CacheAccess;

  it('serves the deepest cached zone cut for a name under it', () => {
    const r = make();
    r.cacheDelegation('dev', 'wsky.dev', ['1.1.1.1']);
    r.cacheDelegation('wsky.dev', 'www.wsky.dev', ['2.2.2.2']);
    expect(r.cachedDelegation('www.wsky.dev', 'A')).toEqual(['2.2.2.2']);
    expect(r.cachedDelegation('other.dev', 'A')).toEqual(['1.1.1.1']);
    expect(r.cachedDelegation('example.com', 'A')).toBeUndefined();
  });

  it('skips the exact-name entry for DS queries (DS lives in the parent zone)', () => {
    const r = make();
    r.cacheDelegation('dev', 'wsky.dev', ['1.1.1.1']);
    r.cacheDelegation('wsky.dev', 'wsky.dev', ['2.2.2.2']);
    expect(r.cachedDelegation('wsky.dev', 'DS')).toEqual(['1.1.1.1']);
    expect(r.cachedDelegation('wsky.dev', 'DNSKEY')).toEqual(['2.2.2.2']);
    // TLD DS: no cached parent -> falls back to the root servers.
    expect(r.cachedDelegation('dev', 'DS')).toBeUndefined();
  });

  it('ignores writes for zones that are not a suffix of the queried name', () => {
    const r = make();
    r.cacheDelegation('com', 'wsky.dev', ['6.6.6.6']);
    expect(r.cachedDelegation('anything.com', 'A')).toBeUndefined();
  });

  it('keeps the first (higher-trust) entry on repeated writes', () => {
    const r = make();
    r.cacheDelegation('dev', 'wsky.dev', ['1.1.1.1']);
    r.cacheDelegation('dev', 'wsky.dev', ['6.6.6.6']);
    expect(r.cachedDelegation('wsky.dev', 'A')).toEqual(['1.1.1.1']);
  });
});

// --- Live network suite --------------------------------------------------
// These run the FULL DNSSEC chain walk against real authoritative nameservers
// over UDP/TCP:53. Gated behind an env flag so the default suite stays hermetic.
// NOTE: they need unrestricted outbound port 53; a network that intercepts DNS
// (many home routers / captive portals) will make them fail or throw.
// ponytail: network-gated -- set RUN_NETWORK_TESTS=1 to exercise the live chain.
const live = describe.skipIf(!process.env.RUN_NETWORK_TESTS);
const TIMEOUT = 30_000;

live('resolveDnssecChain (live)', () => {
  const resolve = (domain: string) =>
    new AuthoritativeResolver().resolveDnssecChain(domain);

  // Fully signed chains: root down to the leaf, every zone secure and every
  // non-root zone anchored by a matching DS. Spread across algorithms/TLDs.
  describe('secure (fully signed) domains', () => {
    it.each([
      'wsky.dev', // ECDSA P-256 (alg 13)
      'cloudflare.com', // ECDSA
      'ietf.org', // RSA (alg 8)
      'nlnetlabs.nl', // RSA, DNSSEC-software vendor
      'isc.org', // RSA
      'internetsociety.org',
    ])(
      'reports %s as secure with an unbroken chain',
      async (domain) => {
        const chain = assertChain(await resolve(domain));
        expect(chain.status).toBe('secure');
        expect(chain.zones[0].name).toBe('.');
        expect(chain.zones.at(-1)?.name).toBe(domain);
        expect(chain.zones.every((z) => z.status === 'secure')).toBe(true);
        // Every non-root secure zone is authenticated by a DS in its parent.
        for (const zone of chain.zones.slice(1)) {
          expect(zone.dsRecords.some((ds) => ds.matched)).toBe(true);
        }
        // Every zone serves at least one key, and the anchored key is a KSK/SEP.
        for (const zone of chain.zones) {
          expect(zone.keys.length).toBeGreaterThan(0);
          expect(zone.keys.some((k) => k.linked && k.isSep)).toBe(true);
        }
      },
      TIMEOUT,
    );
  });

  // Unsigned domains: root + TLD are signed, but the domain publishes no DS, so
  // the chain stops at the leaf. This is the case the regression turned into a
  // false "broken" -- assert it stays insecure.
  describe('unsigned (insecure) domains', () => {
    it.each(['google.com', 'facebook.com', 'amazon.com', 'microsoft.com'])(
      'reports %s as insecure, not broken',
      async (domain) => {
        const chain = assertChain(await resolve(domain));
        expect(chain.status).toBe('insecure');
        expect(chain.zones[0].status).toBe('secure'); // signed root
        expect(chain.zones.at(-1)?.status).toBe('insecure'); // unsigned leaf
        expect(chain.zones.some((z) => z.status === 'broken')).toBe(false);
        // No signed RRsets are probed for an unsigned leaf.
        expect(chain.zones.at(-1)?.rrsets).toBeUndefined();
      },
      TIMEOUT,
    );
  });

  // Misconfigured domains: DS is published but matches no served key -> bogus.
  describe('misconfigured (broken) domains', () => {
    it(
      'reports dnssec-failed.org as broken',
      async () => {
        // Verisign's canonical test domain: its DS matches no served DNSKEY.
        const chain = assertChain(await resolve('dnssec-failed.org'));
        expect(chain.status).toBe('broken');
        const broken = chain.zones.find((z) => z.status === 'broken');
        expect(broken).toBeDefined();
        // The break is at the misconfigured zone, and its parent chain was fine.
        expect(chain.zones[0].status).toBe('secure');
      },
      TIMEOUT,
    );
  });

  // Negative DNS answers remain observational until NSEC/NSEC3 proof
  // validation is implemented; a bare NXDOMAIN header is not authenticated.
  describe('nonexistent names', () => {
    it(
      'does not turn an unproved NXDOMAIN registered domain into a 404',
      async () => {
        const chain = await resolve(
          'this-domain-definitely-does-not-exist-9q7x2z.com',
        );
        expect(chain.status).toBe('insecure');
        expect(chain.coverage.negativeProofs).toBe('not-implemented');
        expect(chain.query.observation).toBe('unproved-nxdomain');
      },
      TIMEOUT,
    );

    it(
      'reports only the authenticated ancestor for an unproved negative subdomain response',
      async () => {
        const chain = await resolve('does-not-exist-9q7x2z.cloudflare.com');
        expect(chain.status).toBe('secure');
        expect(chain.zones.at(-1)?.name).toBe('cloudflare.com');
        expect(chain.query).toEqual({
          name: 'does-not-exist-9q7x2z.cloudflare.com',
          observation: 'unproved-nodata',
        });
        expect(
          chain.zones
            .at(-1)
            ?.rrsets?.every((rrset) => rrset.status === 'absent'),
        ).toBe(true);
      },
      TIMEOUT,
    );
  });

  it(
    'normalizes mixed-case names (DNS is case-insensitive)',
    async () => {
      const chain = assertChain(await resolve('GooGle.CoM'));
      expect(chain.status).toBe('insecure');
    },
    TIMEOUT,
  );

  // The root is anchored to the hard-coded IANA trust anchor (KSK-2017).
  it(
    'anchors the root against the IANA trust anchor (key tag 20326)',
    async () => {
      const chain = assertChain(await resolve('cloudflare.com'));
      const root = chain.zones[0];
      expect(root.name).toBe('.');
      expect(root.status).toBe('secure');
      expect(root.keys.some((k) => k.keyTag === 20326 && k.linked)).toBe(true);
    },
    TIMEOUT,
  );

  // Rich leaf detail: signed RRsets, a signature expiry, key strength/flags.
  it(
    'reports signed RRsets, a signature expiry, and key strength on a secure leaf',
    async () => {
      const chain = assertChain(await resolve('wsky.dev'));
      const leaf = chain.zones.at(-1);
      expect(leaf?.name).toBe('wsky.dev');
      const secureTypes = leaf?.rrsets
        ?.filter((rrset) => rrset.status === 'secure')
        .map((rrset) => rrset.type);
      expect(secureTypes).toEqual(expect.arrayContaining(['SOA', 'A', 'NS']));
      expect(leaf?.signatureExpiresAt).toBeGreaterThan(0);

      const ksk = leaf?.keys.find((k) => k.isSep);
      expect(ksk?.linked).toBe(true);
      expect(ksk?.bits).toBe(256); // ECDSA P-256 curve size
      expect(ksk?.deprecated).toBe(false);
    },
    TIMEOUT,
  );

  // A plain subdomain of a signed apex collapses onto the registered zone and
  // still validates secure.
  it(
    'evaluates a subdomain of a signed apex as secure',
    async () => {
      const chain = assertChain(await resolve('www.cloudflare.com'));
      expect(chain.status).toBe('secure');
      expect(chain.zones.some((z) => z.name === 'cloudflare.com')).toBe(true);
    },
    TIMEOUT,
  );
});
