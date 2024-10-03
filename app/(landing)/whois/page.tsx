import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';
import { SponsorsSection } from '../_components/sponsors-section';
import { AuthorSection } from './../_components/author-section';
import { TrustedBySection } from './../_components/trusted-by-section';

export const metadata = {
  openGraph: {
    url: '/whois',
  },
  alternates: {
    canonical: '/whois',
  },
};

const WhoisLandingPage: FC = () => {
  return (
    <div className="container space-y-16 pt-24">
      <section>
        <h1 className="mb-8 scroll-m-20 pb-2 text-center text-2xl font-semibold tracking-tight first:mt-0 sm:text-3xl">
          Find WHOIS information for any domain
        </h1>
        <div className="mx-auto max-w-4xl">
          <SearchForm subpage="whois" autofocus />
        </div>
      </section>

      <TrustedBySection subpage="whois" />
      <AuthorSection />
      <SponsorsSection />

      <div className="mx-auto max-w-4xl space-y-4 pt-16 text-center">
        <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          About WHOIS
        </h2>
        <p>
          WHOIS is a protocol used to retrieve detailed information about domain
          names and IP addresses. A WHOIS lookup provides essential data such as
          the domain owner, registration dates, and contact information. This
          information is stored by domain registrars and can be accessed
          publicly, making it a valuable tool for network administrators, web
          developers, and cybersecurity professionals. By querying WHOIS, you
          can verify the status of a domain, check its expiration date, and see
          the administrative and technical contacts associated with it.
        </p>
        <p>
          From a technical perspective, WHOIS is useful for domain research,
          ensuring proper domain registration management, and tracking the
          ownership of websites. It’s particularly important for verifying
          domain availability, identifying the current owner, and preventing
          domain squatting. Additionally, WHOIS is often used in cybersecurity
          to trace the origins of suspicious activity or investigate potentially
          fraudulent websites. For those managing domains or working in network
          security, WHOIS offers a direct method to gather critical information
          about the internet infrastructure.
        </p>
      </div>
    </div>
  );
};

export default WhoisLandingPage;
