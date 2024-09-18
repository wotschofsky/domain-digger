import type { FC } from 'react';

import { SearchForm } from '../_components/search-form';
import { AuthorSection } from './_components/author-section';
import { FeaturesSection } from './_components/features-section';
import { SponsorsSection } from './_components/sponsors-section';
import { TrustedBySection } from './_components/trusted-by-section';

export const metadata = {
  openGraph: {
    url: '/',
  },
  alternates: {
    canonical: '/',
  },
};

const MainLandingPage: FC = () => {
  return (
    <div className="container space-y-16 pt-24">
      <section>
        <h1 className="mb-8 scroll-m-20 pb-2 text-center text-2xl font-semibold tracking-tight first:mt-0 sm:text-3xl">
          Get details about any Domain
        </h1>
        <div className="mx-auto max-w-4xl">
          <SearchForm autofocus />
        </div>
      </section>

      <TrustedBySection />
      <AuthorSection />
      <SponsorsSection />
      <FeaturesSection className="!mt-32" />
    </div>
  );
};

export default MainLandingPage;
