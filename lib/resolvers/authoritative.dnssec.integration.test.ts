// @vitest-environment node
// Real UDP/fetch are needed here; happy-dom's polyfilled fetch breaks the
// root-server lookup, so this file opts into the Node environment.
import { describe, expect, it } from 'vitest';

import type { DnssecChain } from '@/lib/dnssec';

import { AuthoritativeResolver } from './authoritative';

// Narrows the nullable result (null = NXDOMAIN) for the cases that expect a chain.
const assertChain = (chain: DnssecChain | null): DnssecChain => {
  if (!chain) throw new Error('expected a DNSSEC chain, got null (NXDOMAIN)');
  return chain;
};

// Live network tests: these run the FULL DNSSEC chain walk against real
// authoritative nameservers over UDP:53. They are gated behind an env flag so
// the default suite stays hermetic (no other test hits the network).
// ponytail: network-gated -- set RUN_NETWORK_TESTS=1 to exercise the live chain.
const live = describe.skipIf(!process.env.RUN_NETWORK_TESTS);

live('resolveDnssecChain (live)', () => {
  const resolver = () => new AuthoritativeResolver();

  it('reports a fully signed domain as secure', async () => {
    const chain = assertChain(await resolver().resolveDnssecChain('wsky.dev'));
    expect(chain.overall).toBe('secure');
    expect(chain.zones.map((z) => z.displayName)).toEqual([
      'root',
      'dev',
      'wsky.dev',
    ]);
    expect(chain.zones.every((z) => z.status === 'secure')).toBe(true);
  }, 20_000);

  it('reports another signed domain as secure', async () => {
    const chain = assertChain(
      await resolver().resolveDnssecChain('cloudflare.com'),
    );
    expect(chain.overall).toBe('secure');
  }, 20_000);

  it('reports an unsigned domain as insecure', async () => {
    // google.com is delegated under signed root/com but is itself unsigned.
    // Mixed case also exercises name normalization (DNS is case-insensitive).
    const chain = assertChain(
      await resolver().resolveDnssecChain('GooGle.coM'),
    );
    expect(chain.overall).toBe('insecure');
    // root and the TLD are signed; the leaf zone is the unsigned one.
    expect(chain.zones[0].status).toBe('secure');
    expect(chain.zones.at(-1)?.status).toBe('insecure');
  }, 20_000);

  it('returns null for a nonexistent (NXDOMAIN) registered domain', async () => {
    const chain = await resolver().resolveDnssecChain(
      'this-domain-definitely-does-not-exist-9q7x2.com',
    );
    expect(chain).toBeNull();
  }, 20_000);

  it('returns null for a nonexistent subdomain of an existing domain', async () => {
    // cloudflare.com exists and is signed, but this leaf does not exist.
    const chain = await resolver().resolveDnssecChain(
      'does-not-exist-9q7x2.cloudflare.com',
    );
    expect(chain).toBeNull();
  }, 20_000);

  it('reports a DNSSEC-misconfigured domain as broken', async () => {
    // Verisign's dnssec-failed.org publishes a DS that no served DNSKEY
    // matches -- a break our digest-chain check detects.
    const chain = assertChain(
      await resolver().resolveDnssecChain('dnssec-failed.org'),
    );
    expect(chain.overall).toBe('broken');
  }, 20_000);
});
