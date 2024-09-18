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
    </div>
  );
};

export default WhoisLandingPage;
