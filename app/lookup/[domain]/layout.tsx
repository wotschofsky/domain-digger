import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { type FC, type ReactNode, Suspense } from 'react';

import { Card } from '@/components/ui/card';

import { ClientOnly } from '@/components/client-only';
import { isValidDomain } from '@/lib/utils';

import { Footer } from '../../_components/footer';
import { Header } from '../../_components/header';
import { CarbonAdRail } from './_components/carbon-ad';
import { LookupHeader } from './_components/lookup-header';

const StarReminder = dynamic(() =>
  import('./_components/star-reminder').then((m) => ({
    default: m.StarReminder,
  })),
);

type LookupLayoutProps = {
  children: ReactNode;
  params: Promise<{
    domain: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: LookupLayoutProps): Promise<Metadata> => {
  const { domain } = await params;

  return {
    description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain} using Domain Digger, the full open-source toolkit for next-level domain analysis.`,
    openGraph: {
      type: 'website',
      description: `Find DNS records, WHOIS data, SSL/TLS certificate history and other for ${domain} using Domain Digger, the full open-source toolkit for next-level domain analysis.`,
    },
  };
};

type DomainCheckProps = {
  params: LookupLayoutProps['params'];
};

// Streamed responses have already sent a 200 by the time this runs, so an
// invalid domain gets the not-found UI with a 200 status (a soft 404). For a
// real 404, validate the domain in proxy.ts before rendering starts instead.
const DomainCheck: FC<DomainCheckProps> = async ({ params }) => {
  const { domain } = await params;

  if (!isValidDomain(domain)) {
    return notFound();
  }

  return null;
};

// Everything here that shows the domain reads it from the URL on the client,
// so a client navigation renders it at once. A full page load renders it with
// the request instead of prerendering skeletons for it.
const LookupLayout: FC<LookupLayoutProps> = ({ children, params }) => (
  <Suspense>
    <Header showSearch={true} />
    <main className="flex w-full flex-1 flex-col">
      {/* Separate boundary so waiting for the server doesn't hold the page */}
      <Suspense>
        <DomainCheck params={params} />
      </Suspense>

      <LookupHeader />

      <div className="flex flex-1 flex-col p-3">
        <Card className="flex-1 py-8">
          <div className="container flex gap-8 px-5 min-[1400px]:max-w-[calc(1400px-2*.75rem)]">
            <div className="min-w-0 flex-1">{children}</div>

            <CarbonAdRail />
          </div>
        </Card>
      </div>
    </main>
    <Footer />

    <ClientOnly>
      <StarReminder />
    </ClientOnly>
  </Suspense>
);

export default LookupLayout;
