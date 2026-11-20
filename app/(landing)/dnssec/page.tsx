import type { Metadata } from 'next';
import type { FC } from 'react';

import { getLandingHref } from '@/lib/lookup-features';
import { getPageMetadata } from '@/lib/page-metadata';

import { AboutSection, LandingPage } from '../_components/landing-page';

export const metadata: Metadata = getPageMetadata({
  url: getLandingHref('dnssec'),
  title: 'DNSSEC Lookup',
});

const DnssecLandingPage: FC = () => (
  <LandingPage
    feature="dnssec"
    heading="Check the DNSSEC chain of trust for any domain"
    tagline="Follow DS digest links and DNSKEY signatures from the IANA root anchors to the name you enter. This is not full DNSSEC validation."
  >
    <AboutSection title="About this DNSSEC lookup">
      <p>
        A parent zone publishes a DS digest for a child zone’s DNSKEY, and that
        key signs the child’s DNSKEY set. This lookup checks both from the IANA
        root anchors down to the queried name and shows where the chain stops.
        It does not yet check signatures over DS records or other records.
      </p>
    </AboutSection>
  </LandingPage>
);

export default DnssecLandingPage;
