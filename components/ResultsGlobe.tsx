'use client';

import type { FC } from 'react';
import Globe from 'react-globe.gl';

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

const ResultsGlobe: FC<ResultsGlobeProps> = ({ markers }) => (
  <Globe
    // Map from https://github.com/vasturiano/three-globe/blob/7717c8e54c98dcb3e92df5a95923f51387a496a1/example/img/earth-day.jpg
    globeImageUrl="/assets/earth-day.jpg"
    backgroundColor="rgba(0,0,0,0)"
    htmlElementsData={markers}
    // @ts-expect-error
    htmlElement={(d: ResultsGlobeProps['markers'][number]) => {
      const el = document.createElement('div');
      el.innerHTML = `<div class="relative bg-white p-2 rounded-lg shadow-md">
        <h3 class="text-sm font-bold mb-2">${d.name}</h3>
        ${d.results.A.map(
          (ip) => `<p class="text-xs text-gray-500">${ip}</p>`
        ).join('')}
      </div>`;
      return el;
    }}
  />
);

export default ResultsGlobe;
