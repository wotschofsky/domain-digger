'use client';

import { initLog } from 'evlog/client';
import PlausibleProvider from 'next-plausible';
import { ThemeProvider } from 'next-themes';
import { type FC, type ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { env } from '@/env';

// Initialize client logging eagerly at module scope instead of via
// EvlogProvider: React runs child effects before parent effects, so an error
// boundary logging a crash during the initial page load would fire before a
// provider effect could enable the transport, silently dropping the event.
// The endpoint deviates from evlog's default /api/_evlog/ingest because
// Next.js excludes underscore-prefixed folders from routing.
if (typeof window !== 'undefined') {
  initLog({
    service: 'domain-digger',
    transport: { enabled: true, endpoint: '/api/evlog/ingest' },
  });
}

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
      customDomain={env.NEXT_PUBLIC_PLAUSIBLE_HOST}
      trackOutboundLinks
      taggedEvents
      domain={env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
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

export const Providers: FC<ProvidersProps> = ({ children }) => (
  <ThemeProvider attribute="class">
    <SWRConfig value={{ fetcher: swrFetcher }}>
      <CustomizedPlausibleProvider>{children}</CustomizedPlausibleProvider>
    </SWRConfig>
  </ThemeProvider>
);
