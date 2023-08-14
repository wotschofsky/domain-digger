'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { type FC, useEffect, useRef } from 'react';

const Analytics: FC = () => {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  const search = useSearchParams();
  const prevSearch = useRef(search);

  useEffect(() => {
    if (prevPathname.current !== pathname || prevSearch.current !== search) {
      prevPathname.current = pathname;
      prevSearch.current = search;

      window._paq.push(['trackPageView']);
    }
  }, [pathname, search]);

  return (
    <Script id="matomo">{`
        var _paq = window._paq = window._paq || [];
        _paq.push(['trackPageView']);
        _paq.push(['enableLinkTracking']);
        _paq.push(['enableHeartBeatTimer', 5]);
        (function() {
          var u="https://analytics.felisk.io/";
          _paq.push(['setTrackerUrl', u + 'accumulator.php']);
          _paq.push(['setSiteId', '13']);
          var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
          g.async=true; g.src=u+'accumulator.js'; s.parentNode.insertBefore(g,s);
        })();
      `}</Script>
  );
};

export default Analytics;
