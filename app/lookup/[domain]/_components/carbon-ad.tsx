'use client';

import { useMediaQuery } from '@uidotdev/usehooks';
import { usePathname, useSelectedLayoutSegment } from 'next/navigation';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';

import { ClientOnly } from '@/components/client-only';

declare global {
  interface Window {
    _carbonads?: { refresh: () => void };
  }
}

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
  // inside the slot. It is added once: a second copy fetches a second ad.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isDesktop) return;

    // Carbon inserts an ad for every request that finishes, so requests that
    // overlap (a quick tab switch) would stack ads. Its policy allows one.
    const observer = new MutationObserver(() => {
      container
        .querySelectorAll('#carbonads')
        .forEach((ad, index) => index > 0 && ad.remove());
    });
    observer.observe(container, { childList: true });

    if (!container.querySelector('script')) {
      const script = document.createElement('script');
      script.async = true;
      script.type = 'text/javascript';
      script.src =
        '//cdn.carbonads.com/carbon.js?serve=CWBI62QJ&placement=diggertools&format=cover';
      script.id = '_carbonads_js';
      script.onerror = onBlocked;
      container.appendChild(script);
    }

    // Ad blockers either fail the script or hide what it renders. The delay
    // gives Carbon time to load, fetch and insert the ad.
    const timer = window.setTimeout(() => {
      const ad = container.querySelector<HTMLElement>('#carbonads');
      if (!ad?.offsetHeight) onBlocked();
    }, 5000);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [isDesktop, onBlocked]);

  // Serves a fresh ad on client-side navigations, which Carbon's placement
  // policy permits, through Carbon's own refresh rather than a second script.
  const servedPathname = useRef(pathname);
  useEffect(() => {
    if (servedPathname.current === pathname) return;
    servedPathname.current = pathname;

    if (isDesktop) window._carbonads?.refresh();
  }, [pathname, isDesktop]);

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
