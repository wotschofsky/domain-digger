import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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

  // resolveDnssecChain returns null for a nonexistent (NXDOMAIN) domain.
  // A rendered chain (secure, insecure, or broken) is a successful lookup.
  await recordLookupAfter(domain, 'dnssec', chain !== null);

  if (!chain) {
    notFound();
  }

  return <ChainDiagram chain={chain} />;
};

export default DnssecResultsPage;
