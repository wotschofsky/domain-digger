import type { Metadata } from 'next';
import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';
import { AuthorSection } from '../_components/author-section';
import { SponsorsSection } from '../_components/sponsors-section';
import { TrustSection } from '../_components/trust-section';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'DNSSEC DS Chain Lookup',
  openGraph: {
    title: 'DNSSEC DS Chain Lookup',
    url: '/dnssec',
  },
  alternates: { canonical: '/dnssec' },
};

const DnssecLandingPage: FC = () => (
  <div className="container space-y-16">
    <div className="flex min-h-[calc(100vh-4.5rem-2rem)] flex-col gap-16 pb-12">
      <div className="flex flex-col gap-20">
        <div className="flex min-h-[40vh] flex-col justify-center pt-24 pb-12">
          <section>
            <h1 className="mb-16 scroll-m-20 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Check the DNSSEC DS chain for any domain
            </h1>
            <div className="mx-auto w-full max-w-2xl">
              <SearchForm subpage="dnssec" autofocus />
            </div>
            <p className="mt-4 mb-20 text-center text-sm/6 text-zinc-500 dark:text-zinc-400">
              Follow DS digest links from the IANA root anchors to the name you
              enter. This is not full DNSSEC validation.
            </p>
          </section>
          <SponsorsSection />
        </div>

        <AuthorSection />
      </div>

      <TrustSection subpage="dnssec" />
    </div>

    <div className="mx-auto max-w-4xl space-y-4 pt-16 text-center">
      <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        About this DNSSEC lookup
      </h2>
      <p>
        A parent zone publishes a DS digest for a child zone’s DNSKEY. This
        lookup compares those digests from the IANA root anchors down to the
        queried name and shows where the chain stops. It does not check DNSSEC
        signatures or other records.
      </p>
    </div>
  </div>
);

export default DnssecLandingPage;
