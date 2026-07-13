import type { Metadata } from 'next';
import type { FC } from 'react';

import { AuthoritativeResolver } from '@/lib/resolvers/authoritative';
import { recordLookupAfter } from '@/lib/search';

import { ChainDiagram } from './_components/chain-diagram';

type DnssecResultsPageProps = {
  params: Promise<{
    domain: string;
  }>;
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
    alternates: {
      canonical: `/lookup/${domain}/dnssec`,
    },
  };
};

export const fetchCache = 'default-no-store';

const DnssecResultsPage: FC<DnssecResultsPageProps> = async ({ params }) => {
  const { domain } = await params;

  // The DNSSEC chain requires per-zone DNSKEY/DS records, which only an
  // authoritative walk exposes -- so this tab always uses the authoritative
  // resolver, ignoring the resolver selector.
  const chain = await new AuthoritativeResolver().resolveDnssecChain(domain);

  // Negative answers are intentionally observational until NSEC/NSEC3 proof
  // validation is implemented, so even an NXDOMAIN response renders coverage
  // instead of becoming a definitive 404.
  await recordLookupAfter(domain, 'dnssec', true);

  return (
    <ChainDiagram
      chain={chain}
      // Request-time wall-clock read (intentional: it stamps this live walk).
      // eslint-disable-next-line react-hooks/purity
      checkedAt={Date.now()}
    />
  );
};

export default DnssecResultsPage;
