import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { FC } from 'react';

import {
  DsChainNameNotFoundError,
  type DsChainVerdict,
  type DsChainZone,
  dsDigestName,
  resolveDsChain,
} from '@/lib/dnssec/ds-chain';
import { AuthoritativeResolver } from '@/lib/resolvers/authoritative';
import { recordLookupAfter } from '@/lib/search';

type DnssecResultsPageProps = {
  params: Promise<{ domain: string }>;
};

export const generateMetadata = async ({
  params,
}: DnssecResultsPageProps): Promise<Metadata> => {
  const { domain } = await params;
  return {
    title: `DNSSEC Lookup for ${domain}`,
    openGraph: {
      title: `DNSSEC Lookup for ${domain}`,
      url: `/lookup/${domain}/dnssec`,
    },
    alternates: { canonical: `/lookup/${domain}/dnssec` },
  };
};

const VERDICT_LABELS: Record<DsChainVerdict, string> = {
  intact: 'Chain intact',
  unsigned: 'Unsigned',
  mismatch: 'DS mismatch',
  'bad-signature': 'Bad DNSKEY signature',
};

const formatDate = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toISOString().slice(0, 10);

const describeKeySignature = ({
  outcome,
  inception,
  expiration,
}: NonNullable<DsChainZone['keySignature']>): string => {
  switch (outcome) {
    case 'valid':
      return `Valid until ${formatDate(expiration!)}`;
    case 'expired':
      return `Expired on ${formatDate(expiration!)}`;
    case 'not-yet-valid':
      return `Not valid before ${formatDate(inception!)}`;
    case 'missing':
      return 'Missing';
    case 'unauthenticated-signer':
      return 'Not made by a DS-linked key';
    case 'invalid':
      return 'Invalid';
  }
};

const isBroken = (status: DsChainVerdict): boolean =>
  status === 'mismatch' || status === 'bad-signature';

const shortFingerprint = (hex: string): string =>
  hex.length > 24 ? `${hex.slice(0, 16)}…${hex.slice(-8)}` : hex;

const DnssecResultsPage: FC<DnssecResultsPageProps> = async ({ params }) => {
  const { domain } = await params;
  const resolver = new AuthoritativeResolver();
  let chain;
  try {
    chain = await resolveDsChain(domain, (name, type) =>
      resolver.resolveAnswers(name, type, { dnssecOk: true }),
    );
  } catch (error) {
    if (error instanceof DsChainNameNotFoundError) {
      await recordLookupAfter(domain, 'dnssec', false);
      notFound();
    }
    throw error;
  }

  await recordLookupAfter(domain, 'dnssec', chain.zones.length > 0);
  const coveringZone = chain.zones.at(-1)!.name;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2
          className={`text-2xl font-semibold tracking-tight ${isBroken(chain.verdict) ? 'text-red-700 dark:text-red-400' : ''}`}
        >
          {VERDICT_LABELS[chain.verdict]}
          {chain.breakAt ? ` at ${chain.breakAt}` : ''}
        </h2>
        {coveringZone !== chain.name && (
          <p className="text-sm">
            {chain.name} is not a zone of its own; it is covered by{' '}
            <span className="font-medium">{coveringZone}</span>.
          </p>
        )}
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This view checks DS digest links and DNSKEY signatures.
        </p>
      </header>

      <div className="space-y-4">
        {chain.zones.map((zone) => (
          <section
            key={zone.name}
            className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold break-all">{zone.name}</h3>
              <span
                className={`text-sm font-medium ${isBroken(zone.status) ? 'text-red-700 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-300'}`}
              >
                {zone.status === 'intact'
                  ? 'Intact'
                  : VERDICT_LABELS[zone.status]}
              </span>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">DNSKEYs</h4>
                {zone.keys.length ? (
                  <ul className="space-y-2 text-sm">
                    {zone.keys.map((key, index) => (
                      <li
                        key={`${key.keyTag}-${key.algorithm}-${index}`}
                        className="break-words"
                      >
                        <span className="font-mono">{key.keyTag}</span>{' '}
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {key.algorithmName} · {key.isSep ? 'KSK' : 'ZSK'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No DNSKEYs
                  </p>
                )}
                {zone.keySignature && (
                  <p
                    className={`mt-3 text-sm ${zone.keySignature.outcome === 'valid' ? 'text-zinc-600 dark:text-zinc-300' : 'text-red-700 dark:text-red-400'}`}
                  >
                    Signature: {describeKeySignature(zone.keySignature)}
                  </p>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  {zone.name === '.' ? 'IANA trust anchor' : 'Parent DS'}
                </h4>
                {zone.dsRecords.length ? (
                  <ul className="space-y-3 text-sm">
                    {zone.dsRecords.map((ds, index) => (
                      <li
                        key={`${ds.keyTag}-${ds.digestHex}-${index}`}
                        className="space-y-1"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono">{ds.keyTag}</span>
                          <span className="text-zinc-600 dark:text-zinc-300">
                            {dsDigestName(ds.digestType)}
                          </span>
                          {ds.weakDigest && (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                              Weak digest
                            </span>
                          )}
                          <span
                            className={
                              !ds.matched && zone.status === 'mismatch'
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-zinc-600 dark:text-zinc-300'
                            }
                          >
                            {ds.matched ? 'Matched' : 'No match'}
                          </span>
                        </div>
                        <code className="block text-xs break-all text-zinc-500 dark:text-zinc-400">
                          {shortFingerprint(ds.digestHex)}
                        </code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No DS records
                  </p>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Signatures over DS records and the queried name’s own records are not
        verified yet, so a forged DS or record is not detected.
      </p>
    </div>
  );
};

export default DnssecResultsPage;
