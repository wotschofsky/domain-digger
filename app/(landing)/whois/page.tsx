import type { Metadata } from 'next';
import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';
import { AuthorSection } from '../_components/author-section';
import { SponsorsSection } from '../_components/sponsors-section';
import { TrustSection } from '../_components/trust-section';

export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'WHOIS Lookup',
  openGraph: {
    title: 'WHOIS Lookup',
    url: '/whois',
  },
  alternates: {
    canonical: '/whois',
  },
};

const WhoisLandingPage: FC = () => (
  <div className="container space-y-16">
    <div className="flex min-h-[calc(100vh-4.5rem-2rem)] flex-col justify-between gap-16 pb-12">
      <div className="flex min-h-[40vh] flex-col justify-center py-20">
        <section>
          <h1 className="mb-16 scroll-m-20 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Find WHOIS information for any domain
          </h1>
          <div className="mx-auto w-full max-w-2xl">
            <SearchForm subpage="whois" autofocus />
          </div>
          <p className="mt-4 mb-20 text-center text-sm/6 text-zinc-500 dark:text-zinc-400">
            Find all DNS records, WHOIS data, SSL/TLS certificate history,
            subdomains and more
          </p>
        </section>
        <SponsorsSection />
      </div>

      <AuthorSection />

      <TrustSection subpage="whois" />
    </div>

    <div className="mx-auto max-w-4xl space-y-4 pt-16 text-center">
      <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        About WHOIS
      </h2>
      <p>
        WHOIS is a protocol used to retrieve detailed information about domain
        names and IP addresses. A WHOIS lookup provides essential data such as
        the domain owner, registration dates, and contact information. This
        information is stored by domain registrars and can be accessed publicly,
        making it a valuable tool for network administrators, web developers,
        and cybersecurity professionals. By querying WHOIS, you can verify the
        status of a domain, check its expiration date, and see the
        administrative and technical contacts associated with it.
      </p>
      <p>
        From a technical perspective, WHOIS is useful for domain research,
        ensuring proper domain registration management, and tracking the
        ownership of websites. It’s particularly important for verifying domain
        availability, identifying the current owner, and preventing domain
        squatting. Additionally, WHOIS is often used in cybersecurity to trace
        the origins of suspicious activity or investigate potentially fraudulent
        websites. For those managing domains or working in network security,
        WHOIS offers a direct method to gather critical information about the
        internet infrastructure.
      </p>
    </div>
  </div>
);

export default WhoisLandingPage;
