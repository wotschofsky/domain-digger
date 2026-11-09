import type { Metadata } from 'next';
import type { FC } from 'react';

import { getLandingHref, getPageMetadata } from '@/lib/lookup-features';

import { AboutSection, LandingPage } from '../_components/landing-page';

export const metadata: Metadata = getPageMetadata(
  getLandingHref('subdomains'),
  'Subdomain Search',
);

const SubdomainsLandingPage: FC = () => (
  <LandingPage
    feature="subdomains"
    heading="Find hidden subdomains for any domain"
  >
    <AboutSection title="What is a Subdomain Finder?">
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
    </AboutSection>
  </LandingPage>
);

export default SubdomainsLandingPage;
