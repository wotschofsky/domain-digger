'use client';

import { useMediaQuery } from '@uidotdev/usehooks';
import { usePathname, useSelectedLayoutSegment } from 'next/navigation';
import { type FC, useEffect, useRef } from 'react';

import { ClientOnly } from '@/components/client-only';

type CarbonAdProps = {
  className?: string;
};

const CarbonAd: FC<CarbonAdProps> = ({ className }) => {
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

// These tabs need the full width of the results card
const FULL_WIDTH_TABS = ['certs', 'map'];

export const CarbonAdRail: FC = () => {
  const tab = useSelectedLayoutSegment();

  if (tab && FULL_WIDTH_TABS.includes(tab)) return null;

  // Width is reserved in CSS so the results don't shift when the ad mounts
  return (
    <aside className="hidden w-80 shrink-0 xl:block">
      <ClientOnly>
        <CarbonAd className="sticky top-6" />
      </ClientOnly>
    </aside>
  );
};
