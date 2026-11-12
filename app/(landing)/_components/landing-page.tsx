import type { FC, ReactNode } from 'react';

import { SearchForm } from '../../_components/search-form';
import { AuthorSection } from './author-section';
import { SponsorsSection } from './sponsors-section';
import { TrustSection } from './trust-section';

type LandingPageProps = {
  // The results tab that searches and the logo links open; DNS when left out
  subpage?: string;
  heading: string;
  tagline?: ReactNode;
  // Shown below the hero
  children: ReactNode;
};

export const LandingPage: FC<LandingPageProps> = ({
  subpage,
  heading,
  tagline = 'Find all DNS records, WHOIS data, SSL/TLS certificate history, subdomains and more',
  children,
}) => (
  <div className="container space-y-16">
    <div className="flex min-h-[calc(100vh-4.5rem-2rem)] flex-col gap-16 pb-12">
      <div className="flex flex-col gap-20">
        <div className="flex min-h-[40vh] flex-col justify-center pt-24 pb-12">
          <section>
            <h1 className="mb-16 scroll-m-20 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              {heading}
            </h1>
            <div className="mx-auto w-full max-w-2xl">
              <SearchForm subpage={subpage} autofocus />
            </div>
            <p className="mt-4 mb-20 text-center text-sm/6 text-zinc-500 dark:text-zinc-400">
              {tagline}
            </p>
          </section>
          <SponsorsSection />
        </div>

        <AuthorSection />
      </div>

      <TrustSection subpage={subpage} />
    </div>

    {children}
  </div>
);

type AboutSectionProps = {
  title: string;
  children: ReactNode;
};

export const AboutSection: FC<AboutSectionProps> = ({ title, children }) => (
  <div className="mx-auto max-w-4xl space-y-4 pt-16 text-center">
    <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
      {title}
    </h2>
    {children}
  </div>
);
