import type { FC } from 'react';

import { SearchForm } from '../_components/search-form';
import { AuthorSection } from './_components/author-section';
import { FeaturesSection } from './_components/features-section';
import { SponsorsSection } from './_components/sponsors-section';
import { TrustSection } from './_components/trust-section';

export const revalidate = 86400; // 24 hours

export const metadata = {
  openGraph: {
    url: '/',
  },
  alternates: {
    canonical: '/',
  },
};

const MainLandingPage: FC = () => (
  <div className="container space-y-16">
    <div className="flex min-h-[calc(100vh-4.5rem-2rem)] flex-col justify-between gap-16 pb-12">
      <div className="flex min-h-[40vh] flex-col justify-center py-24">
        <section>
          <h1 className="mb-16 scroll-m-20 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Get details about any Domain
          </h1>
          <div className="mx-auto w-full max-w-2xl">
            <SearchForm autofocus />
          </div>
          <p className="mb-20 mt-4 text-center text-sm/6 text-zinc-500 dark:text-zinc-400">
            Find all DNS records, WHOIS data, SSL/TLS certificate history,
            subdomains and more
          </p>
        </section>
        <SponsorsSection />
      </div>

      <AuthorSection />

      <TrustSection />
    </div>

    <FeaturesSection className="!mt-32" />
  </div>
);

export default MainLandingPage;
