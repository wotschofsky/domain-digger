import type { Metadata } from 'next';
import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';
import { AuthorSection } from '../_components/author-section';
import { SponsorsSection } from '../_components/sponsors-section';
import { TrustSection } from '../_components/trust-section';

export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: 'DNS Propagation Map',
  openGraph: {
    title: 'DNS Propagation Map',
    url: '/',
  },
  alternates: {
    canonical: '/',
  },
};

const MapLandingPage: FC = () => (
  <div className="container space-y-16">
    <div className="flex min-h-[calc(100vh-4.5rem-2rem)] flex-col justify-between gap-16 pb-12">
      <div className="flex min-h-[40vh] flex-col justify-center py-20">
        <section>
          <h1 className="mb-16 scroll-m-20 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Run DNS lookups across multiple regions
          </h1>
          <div className="mx-auto w-full max-w-2xl">
            <SearchForm subpage="map" autofocus />
          </div>
          <p className="mb-20 mt-4 text-center text-sm/6 text-zinc-500 dark:text-zinc-400">
            Find all DNS records, WHOIS data, SSL/TLS certificate history,
            subdomains and more
          </p>
        </section>
        <SponsorsSection />
      </div>

      <AuthorSection />

      <TrustSection subpage="map" />
    </div>

    <div className="mx-auto max-w-4xl space-y-4 pt-16 text-center">
      <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        About DNS Map
      </h2>
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
    </div>
  </div>
);

export default MapLandingPage;
