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

// carbon.js must only ever load once per document, so the tag outlives the
// slot and is moved back in when the slot returns from an ad-free tab
let script: HTMLScriptElement | undefined;
// Once no ad could be shown, later lookups in this document skip the wait
let adBlocked = false;

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
  // inside the slot.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isDesktop) return;

    // Carbon inserts an ad for every response it gets and cancels nothing.
    // Moving the tag into a new slot refreshes even if an earlier request is
    // still pending, so two ads can land. Carbon's policy allows one.
    let adSeen = Boolean(
      container.querySelector<HTMLElement>('#carbonads')?.offsetHeight,
    );
    const observer = new MutationObserver(() => {
      const ads = container.querySelectorAll<HTMLElement>('#carbonads');
      if (ads[0]?.offsetHeight) adSeen = true;
      ads.forEach((ad, index) => index > 0 && ad.remove());
    });
    observer.observe(container, { childList: true });

    if (!script) {
      script = document.createElement('script');
      script.async = true;
      script.type = 'text/javascript';
      script.src =
        '//cdn.carbonads.com/carbon.js?serve=CWBI62QJ&placement=diggertools&format=cover';
      script.id = '_carbonads_js';
    }
    script.onerror = onBlocked;
    if (script.parentNode !== container) {
      container.appendChild(script);
      // Moving the tag doesn't run it again, so ask Carbon for an ad directly
      window._carbonads?.refresh();
    }

    // Ad blockers either fail the script or hide what it renders. The delay
    // gives Carbon time to load, fetch and insert the ad. An ad that was
    // visible at any point counts: a refresh empties the slot for a moment.
    const timer = window.setTimeout(() => {
      const ad = container.querySelector<HTMLElement>('#carbonads');
      if (!adSeen && !ad?.offsetHeight) onBlocked();
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
    // Not marked as served while hidden, so widening the window catches up
    if (!isDesktop || servedPathname.current === pathname) return;
    servedPathname.current = pathname;

    // With no ad in the slot there is nothing to replace. Usually a request is
    // still in flight and its ad serves this page too. If that request ended
    // without an ad, the slot stays empty until the rail is mounted again.
    if (containerRef.current?.querySelector('#carbonads')) {
      window._carbonads?.refresh();
    }
  }, [pathname, isDesktop]);

  return <div ref={containerRef} className={className} />;
};

// These tabs need the full width of the results card
const FULL_WIDTH_TABS = ['certs', 'map'];

export const CarbonAdRail: FC = () => {
  const tab = useSelectedLayoutSegment();
  // Gives the results their full width back when no ad shows up
  const [blocked, setBlocked] = useState(adBlocked);
  const handleBlocked = useCallback(() => {
    adBlocked = true;
    setBlocked(true);
  }, []);

  if (blocked || (tab && FULL_WIDTH_TABS.includes(tab))) return null;

  // Width is reserved in CSS so the results don't shift when the ad mounts.
  // Without JavaScript no ad can load, so the rail gives its width back.
  return (
    <aside className="hidden w-60 shrink-0 xl:block xl:noscript:hidden">
      <ClientOnly>
        <CarbonAd className="sticky top-6 min-h-52" onBlocked={handleBlocked} />
      </ClientOnly>
    </aside>
  );
};
