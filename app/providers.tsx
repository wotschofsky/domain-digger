'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { EvlogProvider } from 'evlog/next/client';
import PlausibleProvider from 'next-plausible';
import { ThemeProvider } from 'next-themes';
import {
  type ComponentProps,
  type FC,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { SWRConfig } from 'swr';

import { env } from '@/env';

// Analytics load only once BotID judges the visitor human, so headless browsers
// that render pages stay out of Plausible and Vercel Analytics. Pages themselves
// still render for everyone, crawlers included.
// ponytail: checks once per full page load; cache the answer in sessionStorage
// if Deep Analysis checks get expensive.
const useIsHuman = () => {
  const [isHuman, setIsHuman] = useState(false);

  useEffect(() => {
    fetch('/api/is-human', { method: 'POST' })
      .then((response) => response.json())
      .then((body) => setIsHuman(body.isHuman === true))
      // A failed check leaves analytics off
      .catch(() => {});
  }, []);

  return isHuman;
};

type CustomizedPlausibleProviderProps = {
  isHuman: boolean;
  children: ReactNode;
};

const CustomizedPlausibleProvider: FC<CustomizedPlausibleProviderProps> = ({
  isHuman,
  children,
}) => {
  if (!env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    return children;
  }

  return (
    <PlausibleProvider
      // undefined keeps next-plausible's production-only default
      enabled={isHuman ? undefined : false}
      // ponytail: legacy script keeps the existing env vars working; move to the
      // site-specific pa-XXXXX.js URL from the Plausible dashboard to drop this.
      src={`${env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? 'https://plausible.io'}/js/script.outbound-links.tagged-events.js`}
      scriptProps={
        {
          defer: true,
          'data-domain': env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
        } as ComponentProps<'script'>
      }
    >
      {children}
    </PlausibleProvider>
  );
};

const swrFetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

type ProvidersProps = {
  children: ReactNode;
};

export const Providers: FC<ProvidersProps> = ({ children }) => {
  const isHuman = useIsHuman();

  return (
    <EvlogProvider
      service="domain-digger"
      // Using the non-default endpoint since default _evlog is considered hidden by Next.js
      transport={{ enabled: true, endpoint: '/api/evlog/ingest' }}
    >
      <ThemeProvider attribute="class">
        <SWRConfig value={{ fetcher: swrFetcher }}>
          <CustomizedPlausibleProvider isHuman={isHuman}>
            {children}
          </CustomizedPlausibleProvider>
        </SWRConfig>
      </ThemeProvider>
      {isHuman && (
        <>
          <SpeedInsights />
          <Analytics />
        </>
      )}
    </EvlogProvider>
  );
};
