import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Viewport } from 'next';
import dynamic from 'next/dynamic';
import type { FC, ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';

import { ClientOnly } from '@/components/client-only';
import { env } from '@/env';

import './globals.css';
import { Providers } from './providers';

const StarReminder = dynamic(() =>
  import('./_components/star-reminder').then((m) => ({
    default: m.StarReminder,
  })),
);

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata = {
  metadataBase: env.SITE_URL ? new URL(env.SITE_URL) : null,
  title: {
    template: '%s - Domain Digger',
    absolute: 'Domain Digger: DNS Lookup, WHOIS Lookup & more',
  },
  description:
    'Domain Digger is the full open-source toolkit for next-level domain analysis, providing detailed DNS, IP, WHOIS data, and SSL/TLS history in a user-friendly, no-install interface.',
  openGraph: {
    type: 'website',
    title: 'Domain Digger: DNS Lookup, WHOIS Lookup & more',
    description:
      'Domain Digger is the full open-source toolkit for next-level domain analysis, providing detailed DNS, IP, WHOIS data, and SSL/TLS history in a user-friendly, no-install interface.',
    url: '/',
  },
  alternates: {
    canonical: '/',
  },
  robots: 'index, follow',
};

type RootLayoutProps = {
  children: ReactNode;
};

const RootLayout: FC<RootLayoutProps> = ({ children }) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-zinc-100 text-zinc-950 antialiased dark:bg-zinc-950 dark:text-white">
        <Providers>
          <div className="flex min-h-screen flex-col items-center justify-center">
            {children}
          </div>
        </Providers>

        <ClientOnly>
          <StarReminder />
        </ClientOnly>
        <Toaster />
        <SpeedInsights />

        {/* Temporary survey embed */}
        <img className="hidden" src="https://cf-survey.wsky.dev" alt="" />
      </body>
    </html>
  );
};

export default RootLayout;
