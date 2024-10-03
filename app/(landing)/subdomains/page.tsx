import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';
import { SponsorsSection } from '../_components/sponsors-section';
import { AuthorSection } from './../_components/author-section';
import { TrustedBySection } from './../_components/trusted-by-section';

export const metadata = {
  openGraph: {
    url: '/subdomains',
  },
  alternates: {
    canonical: '/subdomains',
  },
};

const SubdomainsLandingPage: FC = () => {
  return (
    <div className="container space-y-16 pt-24">
      <section>
        <h1 className="mb-8 scroll-m-20 pb-2 text-center text-2xl font-semibold tracking-tight first:mt-0 sm:text-3xl">
          Find hidden subdomains for any domain
        </h1>
        <div className="mx-auto max-w-4xl">
          <SearchForm subpage="subdomains" autofocus />
        </div>
      </section>

      <TrustedBySection subpage="subdomains" />
      <AuthorSection />
      <SponsorsSection />

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
          exploitation. Regular subdomain scans also help in inventory
          management, ensuring that all public-facing assets are monitored and
          updated as needed. This type of reconnaissance is a key component of
          maintaining a secure network infrastructure.
        </p>
      </div>
    </div>
  );
};

export default SubdomainsLandingPage;
