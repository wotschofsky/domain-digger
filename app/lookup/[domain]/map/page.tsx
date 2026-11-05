import { log } from 'evlog';
import { CheckCircleIcon, InfoIcon, ShieldAlertIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { FC } from 'react';

import { isUserBot } from '@/lib/api';
import { getLookupFeature, getResultsMetadata } from '@/lib/lookup-features';
import { getGlobalLookupResults, getHasDifferences } from '@/lib/map';
import { InternalDoHResolver } from '@/lib/resolvers/internal';
import { recordLookupAfter } from '@/lib/search';

import { IconAlert } from '../_components/icon-alert';
import { ResultsGlobe } from './_components/results-globe';

type MapResultsPageProps = {
  params: Promise<{
    domain: string;
  }>;
};

const feature = getLookupFeature('map');

export const generateMetadata = async ({
  params,
}: MapResultsPageProps): Promise<Metadata> => {
  const { domain } = await params;

  return getResultsMetadata(feature, domain);
};

const MapResultsPage: FC<MapResultsPageProps> = async ({ params }) => {
  const { domain } = await params;

  const headersList = await headers();
  const { isBot, userAgent } = isUserBot(headersList);

  if (feature.blocksBots && isBot) {
    log.info({ message: 'bot_blocked', userAgent, domain });
    return (
      <IconAlert
        className="mx-auto mt-24"
        icon={ShieldAlertIcon}
        title="Bot or crawler detected!"
      >
        To protect our infrastructure, this page is not available for bots or
        crawlers.
        <br />
        But don&apos;t be sad, there&apos;s nothing to crawl here anyway.
      </IconAlert>
    );
  }

  const lookupResults = await getGlobalLookupResults(
    domain,
    (code) => new InternalDoHResolver(code, 'cloudflare'),
  );
  const hasDifferences = getHasDifferences(lookupResults.map((m) => m.results));

  await recordLookupAfter(
    feature,
    domain,
    lookupResults.some(({ results }) =>
      // Optional: a failed lookup's records may be null (unknown, not empty).
      Object.values(results).some((records) => Boolean(records?.length)),
    ),
  );

  return (
    <>
      {hasDifferences ? (
        <IconAlert
          className="mx-auto mt-12"
          icon={InfoIcon}
          title="Different records detected!"
        >
          Not all regions have the same records for this domain. This{' '}
          <i>could</i> be an indication for the use of GeoDNS.
          <br /> Keep in mind however, that some providers rotate their IP
          addresses, which can also lead to different results.
        </IconAlert>
      ) : (
        <IconAlert
          className="mx-auto mt-12"
          icon={CheckCircleIcon}
          title="All records are the same!"
        >
          All records are the same for all regions. Therefore propagation was
          successful and the domain is not using GeoDNS.
        </IconAlert>
      )}

      <div className="mx-[-2rem]">
        <ResultsGlobe domain={domain} markers={lookupResults} />
      </div>
    </>
  );
};

export default MapResultsPage;
