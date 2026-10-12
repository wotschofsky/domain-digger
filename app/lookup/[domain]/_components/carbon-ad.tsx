'use client';

import { useMediaQuery } from '@uidotdev/usehooks';
import { usePathname } from 'next/navigation';
import { type FC, useEffect, useRef } from 'react';

type CarbonAdProps = {
  className?: string;
};

export const CarbonAd: FC<CarbonAdProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // Desktop only, matching the `xl` breakpoint the slot is shown at. The script
  // must not load while the slot is hidden, or Carbon counts unseen ads.
  const isDesktop = useMediaQuery('(min-width: 80rem)');

  // Carbon renders the ad next to its own script tag, so the tag has to live
  // inside the slot. Re-inserting it per pathname serves a fresh ad on
  // client-side navigations, which Carbon's placement policy permits.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isDesktop) return;

    const script = document.createElement('script');
    script.async = true;
    script.type = 'text/javascript';
    script.src =
      '//cdn.carbonads.com/carbon.js?serve=CWBI62QJ&placement=diggertools&format=cover';
    script.id = '_carbonads_js';
    container.appendChild(script);

    return () => container.replaceChildren();
  }, [pathname, isDesktop]);

  return <div ref={containerRef} className={className} />;
};
