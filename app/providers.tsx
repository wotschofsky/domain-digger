'use client';

import { EvlogProvider } from 'evlog/next/client';
import PlausibleProvider from 'next-plausible';
import { ThemeProvider } from 'next-themes';
import { type ComponentProps, type FC, type ReactNode, useEffect } from 'react';
import { SWRConfig } from 'swr';

import { env } from '@/env';
import { useAnalytics } from '@/lib/analytics';

// Trial: reports BotID's verdict for every visitor as a Plausible event, so the
// share of visitors it would drop from analytics can be measured before
// analytics are gated on it.
export const reportBotIdVerdict = (
  reportEvent: ReturnType<typeof useAnalytics>['reportEvent'],
) =>
  fetch('/api/is-human', { method: 'POST' })
    .then((response) => {
      // A failed check is an error, never a bot verdict
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((body): 'human' | 'bot' => (body.isHuman === true ? 'human' : 'bot'))
    .catch(() => 'error' as const)
    .then((result) =>
      // Non-interactive, so single-page visits still count as bounces
      reportEvent('BotID: Check', { result }, { interactive: false }),
    );

const useBotIdTrial = () => {
  const { reportEvent } = useAnalytics();

  useEffect(() => {
    reportBotIdVerdict(reportEvent);
  }, [reportEvent]);
};

type CustomizedPlausibleProviderProps = {
  children: ReactNode;
};

const CustomizedPlausibleProvider: FC<CustomizedPlausibleProviderProps> = ({
  children,
}) => {
  if (!env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    return children;
  }

  return (
    <PlausibleProvider
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
  useBotIdTrial();

  return (
    <EvlogProvider
      service="domain-digger"
      // Using the non-default endpoint since default _evlog is considered hidden by Next.js
      transport={{ enabled: true, endpoint: '/api/evlog/ingest' }}
    >
      <ThemeProvider attribute="class">
        <SWRConfig value={{ fetcher: swrFetcher }}>
          <CustomizedPlausibleProvider>{children}</CustomizedPlausibleProvider>
        </SWRConfig>
      </ThemeProvider>
    </EvlogProvider>
  );
};
