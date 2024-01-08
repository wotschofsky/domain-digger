import type { FC } from 'react';

import ResultsGlobe from '@/components/ResultsGlobe';
import { REGIONS } from '@/lib/data';
import { RawRecord } from '@/lib/resolvers/DnsResolver';

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
      const url = `${
        process.env.SITE_URL ||
        (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
        'http://localhost:3000'
      }/api/internal/resolve/${code}?resolver=cloudflare&type=A&type=AAAA&type=CNAME&domain=${encodeURIComponent(
        domain
      )}`;
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          `Failed to fetch results for ${code} from ${url}: ${response.status} ${response.statusText}`
        );
      const results = (await response.json()) as {
        A: RawRecord[];
        AAAA: RawRecord[];
        CNAME: RawRecord[];
      };

      return {
        ...data,
        results: {
          A: results.A.map((r) => r.data),
          AAAA: results.AAAA.map((r) => r.data),
          CNAME: results.CNAME.map((r) => r.data),
        },
      };
    })
  );

  return <ResultsGlobe markers={markers} />;
};

export default MapResultsPage;
