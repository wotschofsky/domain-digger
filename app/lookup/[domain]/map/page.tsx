import type { FC } from 'react';

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
