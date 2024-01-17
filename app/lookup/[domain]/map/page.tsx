import { isbot } from 'isbot';
import { CheckCircleIcon, InfoIcon, ShieldAlertIcon } from 'lucide-react';
import { headers } from 'next/headers';
import type { FC } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import ResultsGlobe from '@/components/ResultsGlobe';
import { REGIONS } from '@/lib/data';
import InternalDoHResolver from '@/lib/resolvers/InternalDoHResolver';

export const runtime = 'edge';

type MapResultsPageProps = {
  params: {
    domain: string;
  };
};

const MapResultsPage: FC<MapResultsPageProps> = async ({
  params: { domain },
}) => {
  const userAgent = headers().get('user-agent');
  const shouldBlockRequest = !userAgent || isbot(userAgent);

  if (shouldBlockRequest) {
    console.log('Bot detected, blocking request, UA:', userAgent);
    return (
      <Alert className="mx-auto mt-24 w-max">
        <ShieldAlertIcon className="h-4 w-4" />
        <AlertTitle>Bot or crawler detected!</AlertTitle>
        <AlertDescription>
          To protect our infrastructure, this page is not available for bots or
          crawlers.
          <br />
          But don&apos;t be sad, there&apos;s to crawl here anyway.
        </AlertDescription>
      </Alert>
    );
  }

  const markers = await Promise.all(
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

  let hasDifferentRecords = false;
  for (let i = 1; i < markers.length; i++) {
    const previous = markers[i - 1].results;
    const current = markers[i].results;
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

  return (
    <>
      <Alert className="mx-auto mt-16 w-max">
        {hasDifferentRecords ? (
          <>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Different records detected!</AlertTitle>
            <AlertDescription>
              Not all regions have the same records for this domain. This{' '}
              <i>could</i> be an indication for the use of GeoDNS.
              <br /> Keep in mind however, that some providers rotate their IP
              addresses, which can also lead to different results.
            </AlertDescription>
          </>
        ) : (
          <>
            <CheckCircleIcon className="h-4 w-4" />
            <AlertTitle>All records are the same!</AlertTitle>
            <AlertDescription>
              All records are the same for all regions. Therefore propagation
              was successful and the domain is not using GeoDNS.
            </AlertDescription>
          </>
        )}
      </Alert>
      <ResultsGlobe domain={domain} markers={markers} />
    </>
  );
};

export default MapResultsPage;
