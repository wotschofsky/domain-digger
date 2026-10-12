'use client';

import { useMediaQuery } from '@uidotdev/usehooks';
import { usePathname, useSelectedLayoutSegment } from 'next/navigation';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';

import { ClientOnly } from '@/components/client-only';

type CarbonAdProps = {
  className?: string;
  onBlocked: () => void;
};

const CarbonAd: FC<CarbonAdProps> = ({ className, onBlocked }) => {
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

    // Ad blockers either fail the script or hide what it renders. The delay
    // gives Carbon time to fetch and insert the ad after its script loads.
    let timer: number;
    script.onerror = onBlocked;
    script.onload = () => {
      timer = window.setTimeout(() => {
        const ad = container.querySelector<HTMLElement>('#carbonads');
        if (!ad?.offsetHeight) onBlocked();
      }, 3000);
    };
    container.appendChild(script);

    return () => {
      window.clearTimeout(timer);
      container.replaceChildren();
    };
  }, [pathname, isDesktop, onBlocked]);

  return <div ref={containerRef} className={className} />;
};

// These tabs need the full width of the results card
const FULL_WIDTH_TABS = ['certs', 'map'];

export const CarbonAdRail: FC = () => {
  const tab = useSelectedLayoutSegment();
  // Gives the results their full width back when no ad shows up
  const [blocked, setBlocked] = useState(false);
  const handleBlocked = useCallback(() => setBlocked(true), []);

  if (blocked || (tab && FULL_WIDTH_TABS.includes(tab))) return null;

  // Width is reserved in CSS so the results don't shift when the ad mounts
  return (
    <aside className="hidden w-80 shrink-0 xl:block">
      <ClientOnly>
        <CarbonAd className="sticky top-6" onBlocked={handleBlocked} />
      </ClientOnly>
    </aside>
  );
};
