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
      AAAA: string[];
      CNAME: string[];
    };
  }[];
};

const ResultsGlobe: FC<ResultsGlobeProps> = ({ markers }) => {
  const { resolvedTheme } = useTheme();
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
          resolvedTheme === 'dark'
            ? '/assets/earth-night.jpg'
            : '/assets/earth-day.jpg'
        }
        backgroundColor="rgba(0,0,0,0)"
        width={width}
        htmlElementsData={markers}
        // @ts-expect-error
        htmlElement={(d: ResultsGlobeProps['markers'][number]) => {
          const el = document.createElement('div');
          el.classList.add('marker-wrapper');
          el.innerHTML = `<div class="flex flex-col gap-2 rounded-lg bg-background p-2 shadow-md">
            <h3 class="text-sm font-bold">${d.name}</h3>
            <div>
              ${d.results.A.slice(0, 4)
                .map(
                  (value) =>
                    `<p class="text-xs text-muted-foreground">${value}</p>`
                )
                .join('')}
              ${
                d.results.A.length > 4
                  ? `<p class="text-xs text-muted-foreground italic">and ${
                      d.results.A.length - 4
                    } more</p>`
                  : ''
              }
            </div>

            <div>
              ${d.results.AAAA.slice(0, 4)
                .map(
                  (value) =>
                    `<p class="text-xs text-muted-foreground">${value}</p>`
                )
                .join('')}
              ${
                d.results.AAAA.length > 4
                  ? `<p class="text-xs text-muted-foreground italic">and ${
                      d.results.AAAA.length - 4
                    } more</p>`
                  : ''
              }
            </div>


            <div>
              ${d.results.CNAME.slice(0, 4)
                .map(
                  (value) =>
                    `<p class="text-xs text-muted-foreground">${value}</p>`
                )
                .join('')}
              ${
                d.results.CNAME.length > 4
                  ? `<p class="text-xs text-muted-foreground italic">and ${
                      d.results.CNAME.length - 4
                    } more</p>`
                  : ''
              }
            </div>
          </div>`;
          return el;
        }}
      />
    </div>
  );
};

export default ResultsGlobe;
