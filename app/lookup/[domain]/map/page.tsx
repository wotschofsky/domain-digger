import { log } from 'evlog';
import {
  CheckCircleIcon,
  InfoIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { FC } from 'react';

import { isUserBot } from '@/lib/api';
import { getGlobalLookupResults, getHasDifferences } from '@/lib/map';
import { getPageMetadata } from '@/lib/page-metadata';
import { InternalDoHResolver } from '@/lib/resolvers/internal';

import { IconAlert } from '../_components/icon-alert';
import { ResultsGlobe } from './_components/results-globe';

type MapResultsPageProps = {
  params: Promise<{
    domain: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: MapResultsPageProps): Promise<Metadata> => {
  const { domain } = await params;

  return getPageMetadata(
    `/lookup/${domain}/map`,
    `DNS Propagation for ${domain}`,
  );
};

const MapResultsPage: FC<MapResultsPageProps> = async ({ params }) => {
  const { domain } = await params;

  const headersList = await headers();
  const { isBot, userAgent } = isUserBot(headersList);

  if (isBot) {
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
      ) : lookupResults.some(({ results }) =>
          // null marks a failed lookup, which can't confirm propagation.
          Object.values(results).includes(null),
        ) ? (
        <IconAlert
          className="mx-auto mt-12"
          icon={TriangleAlertIcon}
          title="Some lookups failed"
        >
          The regions that answered all have the same records, but not every
          region could be checked, so propagation can&apos;t be confirmed.
          Failed lookups are marked on the map.
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
