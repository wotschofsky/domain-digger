// @vitest-environment node
// Real UDP/fetch are needed here; happy-dom's polyfilled fetch breaks the
// root-server lookup, so this file opts into the Node environment.
import { describe, expect, it, vi } from 'vitest';

import type { DnssecChain } from '@/lib/dnssec';

import { UserFacingError } from '../user-facing-error';
import { AuthoritativeResolver } from './authoritative';

// Narrows the nullable result (null = NXDOMAIN) for the cases that expect a chain.
const assertChain = (chain: DnssecChain | null): DnssecChain => {
  if (!chain) throw new Error('expected a DNSSEC chain, got null (NXDOMAIN)');
  return chain;
};

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
        expect(chain.overall).toBe('secure');
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
        expect(chain.overall).toBe('insecure');
        expect(chain.zones[0].status).toBe('secure'); // signed root
        expect(chain.zones.at(-1)?.status).toBe('insecure'); // unsigned leaf
        expect(chain.zones.some((z) => z.status === 'broken')).toBe(false);
        // No signed RRsets are probed for an unsigned leaf.
        expect(chain.zones.at(-1)?.signedTypes).toBeUndefined();
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
        expect(chain.overall).toBe('broken');
        const broken = chain.zones.find((z) => z.status === 'broken');
        expect(broken).toBeDefined();
        // The break is at the misconfigured zone, and its parent chain was fine.
        expect(chain.zones[0].status).toBe('secure');
      },
      TIMEOUT,
    );
  });

  // Nonexistent names resolve to null so the page can render not-found.
  describe('nonexistent names', () => {
    it(
      'returns null for an NXDOMAIN registered domain',
      async () => {
        expect(
          await resolve('this-domain-definitely-does-not-exist-9q7x2z.com'),
        ).toBeNull();
      },
      TIMEOUT,
    );

    it(
      'returns null for an NXDOMAIN subdomain of a signed domain',
      async () => {
        expect(
          await resolve('does-not-exist-9q7x2z.cloudflare.com'),
        ).toBeNull();
      },
      TIMEOUT,
    );
  });

  it(
    'normalizes mixed-case names (DNS is case-insensitive)',
    async () => {
      const chain = assertChain(await resolve('GooGle.CoM'));
      expect(chain.overall).toBe('insecure');
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
      expect(root.displayName).toBe('root');
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
      expect(leaf?.signedTypes).toEqual(
        expect.arrayContaining(['SOA', 'A', 'NS']),
      );
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
      expect(chain.overall).toBe('secure');
      expect(chain.zones.some((z) => z.name === 'cloudflare.com')).toBe(true);
    },
    TIMEOUT,
  );
});
