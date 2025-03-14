'use client';

import h from 'hyperscript';
import naturalCompare from 'natural-compare-lite';
import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  type FC,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { GlobeMethods } from 'react-globe.gl';

import { cn } from '@/lib/utils';

import styles from './results-globe.module.css';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

const createMarkerResults = (results: string[]) => {
  if (results.length === 0) {
    return undefined;
  }

  const sortedResults = results.slice().sort(naturalCompare);
  const isTruncated = sortedResults.length > 5;
  const shownResults = sortedResults.slice(0, isTruncated ? 4 : 5);

  return h(
    'div',
    shownResults.map((value) =>
      h('p.text-xs.text-zinc-500.dark:text-zinc-400', value),
    ),
    isTruncated
      ? h(
          'p.text-xs.text-zinc-500.dark:text-zinc-400.italic',
          `and ${results.length - 4} more`,
        )
      : undefined,
  );
};

const createMarker = (
  label: string,
  results: {
    A: string[];
    AAAA: string[];
    CNAME: string[];
  },
  href: string,
  onClick: () => void,
) =>
  h(
    'div.marker-wrapper',

    h(
      'div.flex.flex-col.gap-2.rounded-lg.border.border-zinc-200.bg-white.p-2.text-zinc-900.shadow-md.dark:border-zinc-800.dark:bg-zinc-900.dark:text-zinc-100',

      h('h3.text-sm.font-bold', label),

      createMarkerResults(results.A),
      createMarkerResults(results.AAAA),
      createMarkerResults(results.CNAME),

      results.A.length === 0 &&
        results.AAAA.length === 0 &&
        results.CNAME.length === 0
        ? h(
            'p.text-xs.text-zinc-500.dark:text-zinc-400.italic',
            'No records found!',
          )
        : undefined,

      h(
        'p.text-xs.text-zinc-500.dark:text-zinc-400.italic',
        h(
          'a.underline.decoration-dotted',
          {
            href,
            onclick: (event: MouseEvent) => {
              event.preventDefault();
              onClick();
            },
          },
          'View full results',
        ),
      ),
    ),
  );

type ResultsGlobeProps = {
  domain: string;
  markers: {
    code: string;
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

export const ResultsGlobe: FC<ResultsGlobeProps> = ({ domain, markers }) => {
  const router = useRouter();
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

  const handleGlobeRef = useCallback((ref: GlobeMethods) => {
    if (!ref) return;
    ref.controls().enableZoom = false;
  }, []);

  const htmlElementHandler = useCallback(
    (data: ResultsGlobeProps['markers'][number]) => {
      const href = `/lookup/${domain}?resolver=cloudflare&location=${data.code}`;
      const onClick = () => router.push(href);
      return createMarker(data.name, data.results, href, onClick);
    },
    [domain, router],
  );

  return (
    <div ref={wrapperRef} className={cn(styles.wrapper, 'w-full')}>
      <Globe
        ref={handleGlobeRef as unknown as RefObject<GlobeMethods | undefined>}
        atmosphereColor="#d4d4d8" // Zinc 300
        // Map based on https://commons.wikimedia.org/wiki/File:BlankMap-Equirectangular.svg
        globeImageUrl={
          resolvedTheme === 'dark'
            ? '/assets/map-dark.png' // Zinc 800 / 600
            : '/assets/map-light.png' // Zinc 50 / 300
        }
        backgroundColor="rgba(0,0,0,0)"
        width={width}
        htmlElementsData={markers}
        // @ts-expect-error
        htmlElement={htmlElementHandler}
      />
    </div>
  );
};
