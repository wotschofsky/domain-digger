import type { Metadata } from 'next';
import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';
import { AuthorSection } from '../_components/author-section';
import { SponsorsSection } from '../_components/sponsors-section';
import { TrustSection } from '../_components/trust-section';

export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'Subdomain Search',
  openGraph: {
    title: 'Subdomain Search',
    url: '/subdomains',
  },
  alternates: {
    canonical: '/subdomains',
  },
};

const SubdomainsLandingPage: FC = () => (
  <div className="container space-y-16">
    <div className="flex min-h-[calc(100vh-4.5rem-2rem)] flex-col justify-between gap-16 pb-12">
      <div className="flex min-h-[40vh] flex-col justify-center py-20">
        <section>
          <h1 className="mb-16 scroll-m-20 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Find hidden subdomains for any domain
          </h1>
          <div className="mx-auto w-full max-w-2xl">
            <SearchForm subpage="subdomains" autofocus />
          </div>
          <p className="mt-4 mb-20 text-center text-sm/6 text-zinc-500 dark:text-zinc-400">
            Find all DNS records, WHOIS data, SSL/TLS certificate history,
            subdomains and more
          </p>
        </section>
        <SponsorsSection />
      </div>

      <AuthorSection />

      <TrustSection subpage="subdomains" />
    </div>

    <div className="mx-auto max-w-4xl space-y-4 pt-16 text-center">
      <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        What is a Subdomain Finder?
      </h2>
      <p>
        A subdomain enumeration tool is designed to discover hidden or
        overlooked subdomains associated with a domain. Subdomains can often
        expose additional services, development environments, or unprotected
        areas of a website that might not be directly visible. These tools
        systematically scan various sources such as DNS records, SSL
        certificates, search engines, and Certificate Transparency logs to
        identify subdomains that may have been missed during standard checks.
        For security professionals, developers, and network administrators,
        finding hidden subdomains is critical to ensuring all assets are
        accounted for and properly secured.
      </p>
      <p>
        Technically, subdomain enumeration tools are essential for identifying
        potential security risks. Hidden subdomains can sometimes expose
        internal resources or outdated systems, making them potential targets
        for attackers. By using these tools, organizations can discover and
        secure vulnerable subdomains, preventing unauthorized access or
        exploitation. Regular subdomain scans also help in inventory management,
        ensuring that all public-facing assets are monitored and updated as
        needed. This type of reconnaissance is a key component of maintaining a
        secure network infrastructure.
      </p>
    </div>
  </div>
);

export default SubdomainsLandingPage;
