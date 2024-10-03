import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';
import { SponsorsSection } from '../_components/sponsors-section';
import { AuthorSection } from './../_components/author-section';
import { TrustedBySection } from './../_components/trusted-by-section';

export const metadata = {
  openGraph: {
    url: '/map',
  },
  alternates: {
    canonical: '/map',
  },
};

const MapLandingPage: FC = () => {
  return (
    <div className="container space-y-16 pt-24">
      <section>
        <h1 className="mb-8 scroll-m-20 pb-2 text-center text-2xl font-semibold tracking-tight first:mt-0 sm:text-3xl">
          Run DNS lookups across multiple regions
        </h1>
        <div className="mx-auto max-w-4xl">
          <SearchForm subpage="map" autofocus />
        </div>
      </section>

      <TrustedBySection subpage="map" />
      <AuthorSection />
      <SponsorsSection />

      <div className="mx-auto max-w-4xl space-y-4 pt-16 text-center">
        <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          About DNS Map
        </h2>
        <p>
          The DNS Map tool (also known as Global DNS) is particularly useful for
          debugging Content Delivery Network (CDN) setups and checking DNS
          propagation. CDNs rely on DNS to route users to the nearest server for
          optimal performance. Any misconfiguration in DNS records, such as
          CNAME or A records pointing to the CDN, can affect website performance
          or lead to downtime. By using DNS Map, you can run DNS queries from 18
          different global locations to see how your CDN&apos;s DNS entries are
          resolved worldwide, ensuring that users are being directed to the
          correct CDN nodes based on their geographic location.
        </p>
        <p>
          Additionally, DNS Map helps in monitoring DNS propagation after making
          changes to CDN configurations. DNS changes, such as updates to CNAME
          records pointing to your CDN provider, can take time to propagate
          across all DNS servers. With DNS Map, you can track the progress of
          these changes by running queries from multiple locations, ensuring
          that the new DNS records are properly propagated across different
          regions. This allows you to catch potential delays or caching issues
          early and ensure that your CDN is delivering content efficiently to
          users globally.
        </p>
      </div>
    </div>
  );
};

export default MapLandingPage;
