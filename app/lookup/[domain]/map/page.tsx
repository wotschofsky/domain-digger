import { CheckCircleIcon, InfoIcon, ShieldAlertIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { FC } from 'react';

import { isUserBot } from '@/lib/api';
import { REGIONS } from '@/lib/data';
import InternalDoHResolver from '@/lib/resolvers/InternalDoHResolver';

import BaseAlert from './_components/BaseAlert';
import ResultsGlobe from './_components/ResultsGlobe';

export const runtime = 'edge';

const getMarkers = (domain: string) =>
  Promise.all(
    Object.entries(REGIONS).map(async ([code, data]) => {
      const resolver = new InternalDoHResolver(code, 'cloudflare');
      // TODO Optimize this to only required records
      const results = await resolver.resolveAllRecords(domain);

      return {
        ...data,
        code,
        results: {
          A: results.A.map((r) => r.data),
          AAAA: results.AAAA.map((r) => r.data),
          CNAME: results.CNAME.map((r) => r.data),
        },
      };
    })
  );

const getHasDifferences = (
  markers: { A: string[]; AAAA: string[]; CNAME: string[] }[]
) => {
  let hasDifferentRecords = false;
  for (let i = 1; i < markers.length; i++) {
    const previous = markers[i - 1];
    const current = markers[i];
    if (
      previous.A.toSorted().toString() !== current.A.toSorted().toString() ||
      previous.AAAA.toSorted().toString() !==
        current.AAAA.toSorted().toString() ||
      previous.CNAME.toSorted().toString() !==
        current.CNAME.toSorted().toString()
    ) {
      hasDifferentRecords = true;
      break;
    }
  }
  return hasDifferentRecords;
};

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

  const markers = await getMarkers(domain);
  const hasDifferences = getHasDifferences(markers.map((m) => m.results));

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

      <ResultsGlobe domain={domain} markers={markers} />
    </>
  );
};

export default MapResultsPage;
