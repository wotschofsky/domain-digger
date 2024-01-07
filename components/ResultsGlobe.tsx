'use client';

import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';
import { type FC, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import styles from './ResultsGlobe.module.css';

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  // Fix to avoid misalignment of labels after resize
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }

    return () => observer.disconnect();
  }, [wrapperRef]);

  return (
    <div ref={wrapperRef} className={cn(styles.wrapper, 'w-full')}>
      <Globe
        // Map from https://github.com/vasturiano/three-globe
        globeImageUrl={
          theme === 'dark' ? '/assets/earth-night.jpg' : '/assets/earth-day.jpg'
        }
        backgroundColor="rgba(0,0,0,0)"
        width={width}
        htmlElementsData={markers}
        // @ts-expect-error
        htmlElement={(d: ResultsGlobeProps['markers'][number]) => {
          const el = document.createElement('div');
          el.classList.add('marker-wrapper');
          el.innerHTML = `<div class="bg-background p-2 rounded-lg shadow-md">
            <h3 class="text-sm font-bold mb-2">${d.name}</h3>
            ${d.results.A.map(
              (ip) => `<p class="text-xs text-muted-foreground">${ip}</p>`
            ).join('')}
          </div>`;
          return el;
        }}
      />
    </div>
  );
};

export default ResultsGlobe;
