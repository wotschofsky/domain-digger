'use client';

import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';
import type { FC } from 'react';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

export const runtime = 'edge';

type ResultsGlobeProps = {
  markers: {
    name: string;
    lat: number;
    lng: number;
    results: {
      A: string[];
    };
  }[];
};

const ResultsGlobe: FC<ResultsGlobeProps> = ({ markers }) => {
  const { theme } = useTheme();

  return (
    <Globe
      // Map from https://github.com/vasturiano/three-globe
      globeImageUrl={
        theme === 'dark' ? '/assets/earth-night.jpg' : '/assets/earth-day.jpg'
      }
      backgroundColor="rgba(0,0,0,0)"
      onZoom={() => false}
      htmlElementsData={markers}
      // @ts-expect-error
      htmlElement={(d: ResultsGlobeProps['markers'][number]) => {
        const el = document.createElement('div');
        el.innerHTML = `<div class="relative bg-background p-2 rounded-lg shadow-md">
          <h3 class="text-sm font-bold mb-2">${d.name}</h3>
          ${d.results.A.map(
            (ip) => `<p class="text-xs text-muted-foreground">${ip}</p>`
          ).join('')}
        </div>`;
        return el;
      }}
    />
  );
};

export default ResultsGlobe;
