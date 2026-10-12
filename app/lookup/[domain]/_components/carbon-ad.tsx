'use client';

import { usePathname } from 'next/navigation';
import { type FC, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

type CarbonAdProps = {
  className?: string;
};

export const CarbonAd: FC<CarbonAdProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Carbon renders the ad next to its own script tag, so the tag has to live
  // inside the slot. Re-inserting it per pathname serves a fresh ad on
  // client-side navigations, which Carbon's placement policy permits.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement('script');
    script.async = true;
    script.type = 'text/javascript';
    script.src =
      '//cdn.carbonads.com/carbon.js?serve=CWBI62QJ&placement=diggertools&format=cover';
    script.id = '_carbonads_js';
    container.appendChild(script);

    return () => container.replaceChildren();
  }, [pathname]);

  // Reserves the height of a typical ad so the page barely shifts on load.
  // Carbon's embed code suggests 280px, which leaves a visible gap below.
  return <div ref={containerRef} className={cn('min-h-52', className)} />;
};
