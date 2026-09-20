import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type {
  DnssecChain,
  DnssecDs,
  DnssecKey,
  DnssecZone,
} from '@/lib/dnssec';

import { ChainDiagram, verdictPresentation } from './chain-diagram';

const key = (over: Partial<DnssecKey> = {}): DnssecKey => ({
  keyTag: 2371,
  algorithm: 13,
  algorithmName: 'ECDSAP256SHA256',
  flags: 257,
  flagNames: 'ZONE + SEP',
  isSep: true,
  isRevoked: false,
  linked: true,
  dsMatched: true,
  bits: 256,
  deprecated: false,
  ...over,
});

const ds = (over: Partial<DnssecDs> = {}): DnssecDs => ({
  keyTag: 2371,
  algorithm: 13,
  algorithmName: 'ECDSAP256SHA256',
  digestType: 2,
  digestName: 'SHA-256',
  digestHex: '15D9766CF2CEE3',
  standby: false,
  weakDigest: false,
  ...over,
});

const zone = (over: Partial<DnssecZone> = {}): DnssecZone =>
  ({
    name: 'example.com',
    status: 'secure',
    inherited: false,
    keys: [],
    dsRecords: [],
    ...over,
  }) as DnssecZone;

// Real chains always start at the root (resolve.ts enforces it), so the
// fixture does too -- a single-zone chain cannot reach the rail, the parent
// name in the copy, or any root special case.
const chainWith = (over: Partial<DnssecChain> = {}): DnssecChain => ({
  status: 'secure',
  zones: [zone({ name: '.' }), zone()],
  coverage: { checkedPositiveRrsetTypes: [] },
  query: { name: 'example.com', observation: 'not-checked' },
  verdict: { kind: 'secure' },
  ...over,
});

const broken = (
  breakZone: Partial<DnssecZone>,
  verdict: DnssecChain['verdict'],
): DnssecChain =>
  chainWith({
    status: 'broken',
    breakAt: 1,
    verdict,
    zones: [
      zone({ name: '.' }),
      zone({ ...breakZone, status: 'broken' } as Partial<DnssecZone>),
    ],
  });

describe('DNSSEC verdict copy', () => {
  it('names the queried zone and its parent for a DS signature failure', () => {
    const presentation = verdictPresentation(
      broken(
        { breakReason: 'bad-ds-signature' },
        { kind: 'break', reason: 'bad-ds-signature' },
      ),
    );

    expect(presentation.title).toBe('Broken');
    expect(presentation.body).toContain('example.com');
    expect(presentation.body).toContain('the root zone');
    expect(presentation.remediation).toBe(
      'To fix: the operator of the parent zone must restore a valid signature over the DS record set.',
    );
  });

  it('points a DS mismatch at the exact tags, de-duplicated on both sides', () => {
    const presentation = verdictPresentation(
      broken(
        {
          breakReason: 'ds-mismatch',
          dsRecords: [
            ds({ keyTag: 111 }),
            ds({ keyTag: 111 }),
            ds({ keyTag: 222 }),
          ],
          keys: [
            key({ keyTag: 333, linked: false, dsMatched: false }),
            key({ keyTag: 333, linked: false, dsMatched: false }),
          ],
        },
        { kind: 'break', reason: 'ds-mismatch' },
      ),
    );

    expect(presentation.body).toContain('key tag 111');
    expect(presentation.remediation).toContain(
      'the DS expects key tag 111, 222',
    );
    expect(presentation.remediation).toContain('served key tags: 333');
  });

  it('says "none" when a mismatching zone serves no keys at all', () => {
    const presentation = verdictPresentation(
      broken(
        {
          breakReason: 'ds-mismatch',
          dsRecords: [ds({ keyTag: 111 })],
          keys: [],
        },
        { kind: 'break', reason: 'ds-mismatch' },
      ),
    );

    expect(presentation.remediation).toContain('served key tags: none');
  });

  it('tells a DS-without-DNSKEY zone how to return to unsigned', () => {
    const presentation = verdictPresentation(
      broken(
        { breakReason: 'no-dnskey' },
        { kind: 'break', reason: 'no-dnskey' },
      ),
    );

    expect(presentation.body).toContain('serves no DNSKEY');
    expect(presentation.remediation).toContain('remove the stale DS record');
  });

  it('dates an expired key-set signature instead of saying only "failed"', () => {
    const presentation = verdictPresentation(
      broken(
        {
          breakReason: 'bad-signature',
          dnskeySignature: { status: 'expired', expiresAt: 1785103200 },
        },
        { kind: 'break', reason: 'bad-signature' },
      ),
    );

    expect(presentation.body).toContain('expired Jul 26, 2026');
  });

  it('falls back when an invalid signature carries no timestamp', () => {
    const presentation = verdictPresentation(
      broken(
        {
          breakReason: 'bad-signature',
          dnskeySignature: { status: 'invalid' },
        },
        { kind: 'break', reason: 'bad-signature' },
      ),
    );

    expect(presentation.body).toContain('expired or failed validation');
  });

  it('calls an unverifiable algorithm "cannot validate", not broken', () => {
    const presentation = verdictPresentation(
      chainWith({
        status: 'insecure',
        breakAt: 1,
        verdict: { kind: 'break', reason: 'unsupported-algorithm' },
        zones: [
          zone({ name: '.' }),
          zone({
            status: 'insecure',
            breakReason: 'unsupported-algorithm',
          }),
        ],
      }),
    );

    expect(presentation.title).toBe('Cannot validate');
    expect(presentation.remediation).toBeNull();
  });

  it('offers signing advice only when the unsigned cut is the queried name', () => {
    const cut = (atLeaf: boolean) =>
      verdictPresentation(
        chainWith({
          status: 'insecure',
          breakAt: 1,
          verdict: { kind: 'unsigned-cut', atLeaf },
          zones: [zone({ name: '.' }), zone({ status: 'insecure' })],
        }),
      );

    expect(cut(true).remediation).toContain('turn on signing at the DNS host');
    expect(cut(false).remediation).toBeNull();
  });

  it('appends the unproved-negative observation to the verdict body', () => {
    const presentation = verdictPresentation(
      chainWith({
        query: {
          name: 'missing.example.com',
          observation: 'unproved-nxdomain',
        },
        verdict: { kind: 'nxdomain-unproved' },
      }),
    );

    expect(presentation.title).toBe('NXDOMAIN observed — not proven');
    expect(presentation.body).toContain('nonexistence is not authenticated');
  });

  it('names the RRset types behind a secure-chain caveat', () => {
    expect(
      verdictPresentation(
        chainWith({
          verdict: { kind: 'secure-rrset-problems', rrsetTypes: ['TXT', 'MX'] },
        }),
      ).body,
    ).toContain('TXT, MX have positive RRset validation issues');

    expect(
      verdictPresentation(
        chainWith({
          verdict: { kind: 'secure-rrset-problems', rrsetTypes: ['TXT'] },
        }),
      ).body,
    ).toContain('TXT has positive RRset validation issues');
  });
});

describe('DNSSEC chain presentation', () => {
  it('pairs the parent DS with its child DNSKEY without repeating either record', () => {
    const matched = key();
    const chain = chainWith({
      zones: [
        zone({ name: '.' }),
        zone({
          keys: [matched],
          dsRecords: [ds({ matchedKey: matched })],
          dsSignature: { status: 'valid', expiresAt: 1785103200 },
          dnskeySignature: { status: 'valid', expiresAt: 1785705840 },
        }),
      ],
    });

    const html = renderToStaticMarkup(createElement(ChainDiagram, { chain }));

    expect(html).toContain('Parent DS → Child DNSKEY');
    expect(html).toContain('aria-label="Explain parent DS to child DNSKEY"');
    expect(html.match(/tag 2371/g)).toHaveLength(2);
    expect(html).toContain('Parent signature');
    expect(html).toContain('Key-set signature');
    expect(html).not.toContain('Parent DS RRSIG');
    expect(html).not.toContain('other DNSKEY');
  });

  it('lists a key no DS points at separately instead of pairing it', () => {
    const matched = key({ keyTag: 2371 });
    const zsk = key({
      keyTag: 4242,
      flags: 256,
      flagNames: 'ZONE',
      isSep: false,
      linked: false,
      dsMatched: false,
    });
    const chain = chainWith({
      zones: [
        zone({ name: '.' }),
        zone({
          keys: [matched, zsk],
          dsRecords: [ds({ matchedKey: matched })],
        }),
      ],
    });

    const html = renderToStaticMarkup(createElement(ChainDiagram, { chain }));

    expect(html).toContain('1 other DNSKEY in this zone');
    expect(html).toContain('tag 4242');
  });

  it('renders an unmatched root anchor as standby, not as a broken link', () => {
    const served = key({ keyTag: 20326 });
    const chain = chainWith({
      zones: [
        zone({
          name: '.',
          keys: [served],
          dsRecords: [
            ds({ keyTag: 20326, matchedKey: served }),
            ds({ keyTag: 38696, standby: true }),
          ],
        }),
        zone(),
      ],
    });

    const html = renderToStaticMarkup(createElement(ChainDiagram, { chain }));

    expect(html).toContain('Standby anchor');
    expect(html).toContain('aria-label="standby"');
    expect(html).not.toContain('No matching DNSKEY');
  });

  it('labels the break edge once and marks the zones below it as inherited', () => {
    const chain = chainWith({
      status: 'broken',
      breakAt: 1,
      verdict: { kind: 'break', reason: 'ds-mismatch' },
      zones: [
        zone({ name: '.' }),
        zone({ status: 'broken', breakReason: 'ds-mismatch' }),
        zone({
          name: 'www.example.com',
          status: 'broken',
          inherited: true,
        }),
      ],
    });

    const html = renderToStaticMarkup(createElement(ChainDiagram, { chain }));

    expect(html).toContain('DS matches no served key');
    // The zone below the break must not restate the break zone's failure.
    expect(html).toContain('Below a broken zone — not validated');
    expect(html.match(/DS matches no served key/g)).toHaveLength(1);
  });

  it('says positive records were not checked when the chain did not validate', () => {
    const html = renderToStaticMarkup(
      createElement(ChainDiagram, {
        chain: chainWith({
          status: 'insecure',
          breakAt: 1,
          verdict: { kind: 'unsigned-cut', atLeaf: true },
          zones: [zone({ name: '.' }), zone({ status: 'insecure' })],
        }),
      }),
    );

    expect(html).toContain('Positive records were not checked');
  });

  it('links a CNAME alias to its own DNSSEC lookup', () => {
    const html = renderToStaticMarkup(
      createElement(ChainDiagram, {
        chain: chainWith({ leafAlias: 'target.example' }),
      }),
    );

    expect(html).toContain('href="/lookup/target.example/dnssec"');
    expect(html).toContain('This name is an alias (CNAME) for');
  });
});
