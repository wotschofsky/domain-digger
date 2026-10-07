import type { Metadata } from 'next';
import type { FC } from 'react';

import { SearchForm } from '../../_components/search-form';

export const metadata: Metadata = {
  title: 'Domain Exposure Lookup',
  alternates: { canonical: '/exposure' },
  openGraph: { title: 'Domain Exposure Lookup', url: '/exposure' },
};

const ExposureLandingPage: FC = () => (
  <div className="container flex flex-1 flex-col items-center justify-center gap-6 py-24">
    <h1 className="text-center text-3xl font-semibold">
      Check domain credential exposure
    </h1>
    <p className="max-w-2xl text-center text-zinc-600 dark:text-zinc-300">
      Explore aggregated infostealer and data-breach exposure with Lunar. Search
      for a domain, then choose Check exposure to request its report.
    </p>
    <div className="w-full max-w-2xl">
      <SearchForm subpage="exposure" autofocus />
    </div>
  </div>
);

export default ExposureLandingPage;
