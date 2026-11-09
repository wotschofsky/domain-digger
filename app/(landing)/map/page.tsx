import type { Metadata } from 'next';
import type { FC } from 'react';

import { getLandingHref, getPageMetadata } from '@/lib/lookup-features';

import { AboutSection, LandingPage } from '../_components/landing-page';

export const metadata: Metadata = getPageMetadata(
  getLandingHref('map'),
  'DNS Propagation Map',
);

const MapLandingPage: FC = () => (
  <LandingPage feature="map" heading="Run DNS lookups across multiple regions">
    <AboutSection title="About DNS Map">
      <p>
        The DNS Map tool (also known as Global DNS) is particularly useful for
        debugging Content Delivery Network (CDN) setups and checking DNS
        propagation. CDNs rely on DNS to route users to the nearest server for
        optimal performance. Any misconfiguration in DNS records, such as CNAME
        or A records pointing to the CDN, can affect website performance or lead
        to downtime. By using DNS Map, you can run DNS queries from 18 different
        global locations to see how your CDN&apos;s DNS entries are resolved
        worldwide, ensuring that users are being directed to the correct CDN
        nodes based on their geographic location.
      </p>
      <p>
        Additionally, DNS Map helps in monitoring DNS propagation after making
        changes to CDN configurations. DNS changes, such as updates to CNAME
        records pointing to your CDN provider, can take time to propagate across
        all DNS servers. With DNS Map, you can track the progress of these
        changes by running queries from multiple locations, ensuring that the
        new DNS records are properly propagated across different regions. This
        allows you to catch potential delays or caching issues early and ensure
        that your CDN is delivering content efficiently to users globally.
      </p>
    </AboutSection>
  </LandingPage>
);

export default MapLandingPage;
