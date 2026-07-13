import type { Metadata } from 'next';
import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';
import { AuthorSection } from '../_components/author-section';
import { SponsorsSection } from '../_components/sponsors-section';
import { TrustSection } from '../_components/trust-section';

export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'DNSSEC Lookup',
  openGraph: {
    title: 'DNSSEC Lookup',
    url: '/dnssec',
  },
  alternates: {
    canonical: '/dnssec',
  },
};

const DnssecLandingPage: FC = () => (
  <div className="container space-y-16">
    <div className="flex min-h-[calc(100vh-4.5rem-2rem)] flex-col gap-16 pb-12">
      <div className="flex flex-col gap-20">
        <div className="flex min-h-[40vh] flex-col justify-center pt-24 pb-12">
          <section>
            <h1 className="mb-16 scroll-m-20 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Verify the DNSSEC chain of trust for any domain
            </h1>
            <div className="mx-auto w-full max-w-2xl">
              <SearchForm subpage="dnssec" autofocus />
            </div>
            <p className="mt-4 mb-20 text-center text-sm/6 text-zinc-500 dark:text-zinc-400">
              Find all DNS records, WHOIS data, SSL/TLS certificate history,
              subdomains and more
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
        What is DNSSEC?
      </h2>
      <p>
        DNSSEC (Domain Name System Security Extensions) adds a layer of trust to
        the DNS by cryptographically signing records, so resolvers can verify
        that an answer really came from the authoritative zone and was not
        forged or tampered with in transit. Each zone signs its records with its
        own keys, and a parent zone vouches for its child by publishing a
        Delegation Signer (DS) record — building an unbroken chain of trust from
        the root zone all the way down to the domain you are looking up.
      </p>
      <p>
        This DNSSEC checker walks that chain from the root trust anchor down to
        the queried domain. It authenticates each observed DS record set,
        verifies that it matches the child&apos;s DNSKEY, validates every
        zone&apos;s key-set signature, and checks common positive record types
        at the queried name. Negative answers, unsigned subdelegations, and
        CNAME targets are not validated yet, so missing data is reported as
        observed rather than cryptographically proven. The result helps
        administrators confirm signed deployments and diagnose broken trust
        links.
      </p>
    </div>
  </div>
);

export default DnssecLandingPage;
