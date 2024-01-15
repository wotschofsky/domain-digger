import { isbot } from 'isbot';
import { ShieldAlertIcon } from 'lucide-react';
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

  return <ResultsGlobe domain={domain} markers={markers} />;
};

export default MapResultsPage;
