import type { FC } from 'react';

import ResultsGlobe from '@/components/ResultsGlobe';
import { RawRecord } from '@/lib/resolvers/DnsResolver';

import './styles.css';

export const runtime = 'edge';

const regions: Record<string, { name: string; lat: number; lng: number }> = {
  arn1: { lat: 59.652222, lng: 17.918611, name: 'Stockholm, Sweden' },
  bom1: { lat: 19.088744, lng: 72.867905, name: 'Mumbai, India' },
  cdg1: { lat: 49.009691, lng: 2.547925, name: 'Paris, France' },
  cle1: { lat: 41.405772, lng: -81.849769, name: 'Cleveland, USA' },
  cpt1: { lat: -33.964806, lng: 18.601667, name: 'Cape Town, South Africa' },
  dub1: { lat: 53.421333, lng: -6.270075, name: 'Dublin, Ireland' },
  fra1: { lat: 50.033333, lng: 8.570556, name: 'Frankfurt, Germany' },
  gru1: { lat: -23.435556, lng: -46.473056, name: 'São Paulo, Brazil' },
  hkg1: { lat: 22.308046, lng: 113.91848, name: 'Hong Kong, China' },
  hnd1: { lat: 35.553333, lng: 139.781111, name: 'Tokyo, Japan' },
  iad1: { lat: 38.944, lng: -77.456, name: 'Dulles, USA' },
  icn1: { lat: 37.4625, lng: 126.439167, name: 'Seoul, South Korea' },
  kix1: { lat: 34.434167, lng: 135.232778, name: 'Osaka, Japan' },
  lhr1: { lat: 51.477, lng: -0.461, name: 'London, UK' },
  pdx1: { lat: 45.5875, lng: -122.593333, name: 'Portland, USA' },
  sfo1: { lat: 37.618056, lng: -122.378611, name: 'San Francisco, USA' },
  sin1: { lat: 1.356944, lng: 103.988611, name: 'Singapore, Singapore' },
  syd1: { lat: -33.946111, lng: 151.177222, name: 'Sydney, Australia' },
};

type MapResultsPageProps = {
  params: {
    domain: string;
  };
};

const MapResultsPage: FC<MapResultsPageProps> = async ({
  params: { domain },
}) => {
  const markers = await Promise.all(
    Object.entries(regions).map(async ([code, data]) => {
      const url = `${
        process.env.SITE_URL ||
        (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
        'http://localhost:3000'
      }/lookup/${domain}/map/resolve/${code}?type=A&domain=${domain}`;
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          `Failed to fetch results for ${code} from ${url}: ${response.status} ${response.statusText}`
        );
      const results = (await response.json()) as RawRecord[];

      return {
        ...data,
        results: {
          A: results.map((r) => r.data),
        },
      };
    })
  );

  return <ResultsGlobe markers={markers} />;
};

export default MapResultsPage;
