import type { Metadata } from 'next';
import type { FC } from 'react';

import { getLandingHref } from '@/lib/lookup-features';
import { getPageMetadata } from '@/lib/page-metadata';

import { AboutSection, LandingPage } from '../_components/landing-page';

export const metadata: Metadata = getPageMetadata({
  url: getLandingHref('whois'),
  title: 'WHOIS Lookup',
});

const WhoisLandingPage: FC = () => (
  <LandingPage feature="whois" heading="Find WHOIS information for any domain">
    <AboutSection title="About WHOIS">
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
    </AboutSection>
  </LandingPage>
);

export default WhoisLandingPage;
