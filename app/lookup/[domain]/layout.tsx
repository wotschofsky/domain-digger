import { ExternalLinkIcon } from 'lucide-react';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { type FC, type ReactNode, Suspense } from 'react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { ClientOnly } from '@/components/client-only';
import { isValidDomain, isWildcardDomain } from '@/lib/utils';

import { Footer } from '../../_components/footer';
import { Header } from '../../_components/header';
import { CarbonAdRail, CarbonAdRailFallback } from './_components/carbon-ad';
import {
  DomainSummary,
  DomainSummarySkeleton,
} from './_components/domain-summary';
import { RelatedDomains } from './_components/related-domains';
import { ResultsTabs } from './_components/results-tabs';
import { ShareButton } from './_components/share-button';

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

type LookupHeaderProps = {
  params: LookupLayoutProps['params'];
};

const LookupHeader: FC<LookupHeaderProps> = async ({ params }) => {
  const { domain } = await params;

  // Streamed responses have already sent a 200 by the time this runs, so an
  // invalid domain gets the not-found UI with a 200 status (a soft 404). For a
  // real 404, validate the domain in proxy.ts before rendering starts instead.
  if (!isValidDomain(domain)) {
    return notFound();
  }

  return (
    <>
      <div className="container space-y-6 pt-12 pb-8">
        <div className="flex w-full items-center gap-4">
          {/* Bottom padding added to avoid clipping */}
          <h1 className="mb-2 flex-1 overflow-hidden pb-1 break-words">
            <span className="block text-zinc-500 dark:text-zinc-400">
              Results for
            </span>
            {isWildcardDomain(domain) ? (
              <span className="block text-4xl font-bold">{domain}</span>
            ) : (
              <a
                className="block text-4xl font-bold"
                href={`https://${domain}`}
                target="_blank"
                rel="noreferrer nofollow"
              >
                {domain} <ExternalLinkIcon className="inline-block" />
              </a>
            )}
          </h1>

          <ShareButton />
        </div>

        <RelatedDomains domain={domain} />
        <DomainSummary domain={domain} />
      </div>

      <div className="container">
        <ResultsTabs domain={domain} />
      </div>
    </>
  );
};

// Matches LookupHeader's rows so the results don't shift when it streams in
const LookupHeaderFallback: FC = () => (
  <>
    <div className="container space-y-6 pt-12 pb-8">
      <div className="flex w-full items-center gap-4">
        <div className="mb-2 flex-1 pb-1">
          <span className="block text-zinc-500 dark:text-zinc-400">
            Results for
          </span>
          <Skeleton className="h-10 w-72 max-w-full" />
        </div>
      </div>

      <Skeleton className="h-6 w-64 max-w-full" />
      <DomainSummarySkeleton />
    </div>

    <div className="container">
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  </>
);

const LookupLayout: FC<LookupLayoutProps> = ({ children, params }) => (
  <>
    <Header showSearch={true} />
    <main className="flex w-full flex-1 flex-col">
      <Suspense fallback={<LookupHeaderFallback />}>
        <LookupHeader params={params} />
      </Suspense>

      <div className="flex flex-1 flex-col p-3">
        <Card className="flex-1 py-8">
          <div className="container flex gap-8 px-5 min-[1400px]:max-w-[calc(1400px-2*.75rem)]">
            <div className="min-w-0 flex-1">{children}</div>

            <Suspense fallback={<CarbonAdRailFallback />}>
              <CarbonAdRail />
            </Suspense>
          </div>
        </Card>
      </div>
    </main>
    <Footer />

    <ClientOnly>
      <StarReminder />
    </ClientOnly>
  </>
);

export default LookupLayout;
