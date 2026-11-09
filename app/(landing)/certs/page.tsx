import type { Metadata } from 'next';
import type { FC } from 'react';

import { getLandingHref, getPageMetadata } from '@/lib/lookup-features';

import { AboutSection, LandingPage } from '../_components/landing-page';

export const metadata: Metadata = getPageMetadata(
  getLandingHref('certs'),
  'Certificate Search',
);

const CertsLandingPage: FC = () => (
  <LandingPage
    feature="certs"
    heading="Find certificate history for any domain"
  >
    <AboutSection title="About Certificate Logs">
      <p>
        Certificate Transparency (CT) logs are public records that track the
        issuance of SSL/TLS certificates, providing a transparent and verifiable
        system for monitoring certificates issued by Certificate Authorities
        (CAs). These logs are append-only and publicly accessible, allowing
        anyone to audit and review certificates issued for domains. By
        referencing CT logs, administrators can verify that no unauthorized or
        misissued certificates have been generated for their domains, ensuring
        the integrity of their SSL/TLS implementations.
      </p>
      <p>
        From a technical perspective, Certificate Transparency logs are crucial
        for improving security by detecting certificate misissuance and
        potential attacks such as man-in-the-middle. By integrating CT log
        monitoring, domain owners can receive real-time alerts when a new
        certificate is issued for their domain, allowing them to respond quickly
        to any anomalies. CT logs also enhance trust across the web by providing
        an open system that anyone can query to audit certificate issuance. This
        mechanism is critical for maintaining a secure web environment and
        ensuring SSL/TLS certificates are properly issued and managed.
      </p>
    </AboutSection>
  </LandingPage>
);

export default CertsLandingPage;
