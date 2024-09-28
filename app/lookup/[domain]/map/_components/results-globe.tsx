'use client';

import h from 'hyperscript';
import naturalCompare from 'natural-compare-lite';
import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';

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
    shownResults.map((value) => h('p.text-xs.text-muted-foreground', value)),
    isTruncated
      ? h(
          'p.text-xs.text-muted-foreground.italic',
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
      'div.flex.flex-col.gap-2.rounded-lg.bg-background.p-2.shadow-md',

      h('h3.text-sm.font-bold', label),

      createMarkerResults(results.A),
      createMarkerResults(results.AAAA),
      createMarkerResults(results.CNAME),

      results.A.length === 0 &&
        results.AAAA.length === 0 &&
        results.CNAME.length === 0
        ? h('p.text-xs.text-muted-foreground.italic', 'No records found!')
        : undefined,

      h(
        'p.text-xs.text-muted-foreground.italic',
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
        htmlElement={htmlElementHandler}
      />
    </div>
  );
};
