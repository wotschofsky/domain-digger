import { CheckCircleIcon, InfoIcon, ShieldAlertIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { FC } from 'react';

import { isUserBot } from '@/lib/api';
import { getGlobalLookupResults, getHasDifferences } from '@/lib/map';
import { InternalDoHResolver } from '@/lib/resolvers/internal';

import { BaseAlert } from './_components/base-alert';
import { ResultsGlobe } from './_components/results-globe';

export const runtime = 'edge';

type MapResultsPageProps = {
  params: {
    domain: string;
  };
};

export const generateMetadata = ({
  params: { domain },
}: MapResultsPageProps): Metadata => ({
  openGraph: {
    url: `/lookup/${domain}/map`,
  },
  alternates: {
    canonical: `/lookup/${domain}/map`,
  },
});

const MapResultsPage: FC<MapResultsPageProps> = async ({
  params: { domain },
}) => {
  const { isBot, userAgent } = isUserBot(headers());

  if (isBot) {
    console.log('Bot detected, blocking request, UA:', userAgent);
    return (
      <BaseAlert icon={ShieldAlertIcon} title="Bot or crawler detected!">
        To protect our infrastructure, this page is not available for bots or
        crawlers.
        <br />
        But don&apos;t be sad, there&apos;s nothing to crawl here anyway.
      </BaseAlert>
    );
  }

  const lookupResults = await getGlobalLookupResults(
    domain,
    (code) => new InternalDoHResolver(code, 'cloudflare')
  );
  const hasDifferences = getHasDifferences(lookupResults.map((m) => m.results));

  return (
    <>
      {hasDifferences ? (
        <BaseAlert icon={InfoIcon} title="Different records detected!">
          Not all regions have the same records for this domain. This{' '}
          <i>could</i> be an indication for the use of GeoDNS.
          <br /> Keep in mind however, that some providers rotate their IP
          addresses, which can also lead to different results.
        </BaseAlert>
      ) : (
        <BaseAlert icon={CheckCircleIcon} title="All records are the same!">
          All records are the same for all regions. Therefore propagation was
          successful and the domain is not using GeoDNS.
        </BaseAlert>
      )}

      <div className="mx-[-2rem]">
        <ResultsGlobe domain={domain} markers={lookupResults} />
      </div>
    </>
  );
};

export default MapResultsPage;
