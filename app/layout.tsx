import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Viewport } from 'next';
import dynamic from 'next/dynamic';
import type { FC, ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';

import { ClientOnly } from '@/components/client-only';
import { env } from '@/env';

import { Footer } from './_components/footer';
import { Header } from './_components/header';
import './globals.css';
import { Providers } from './providers';

const FeedbackPrompt = dynamic(() =>
  import('./_components/feedback-prompt').then((m) => ({
    default: m.FeedbackPrompt,
  })),
);

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata = {
  metadataBase: env.SITE_URL ? new URL(env.SITE_URL) : null,
  title: 'Domain Digger: DNS, WHOIS lookup & more',
  description:
    'Domain Digger is the full open-source toolkit for next-level domain analysis, providing detailed DNS, IP, WHOIS data, and SSL/TLS history in a user-friendly, no-install interface.',
  openGraph: {
    type: 'website',
    title: 'Domain Digger: DNS, WHOIS lookup & more',
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
      <body>
        <Providers>
          <div className="flex min-h-screen flex-col items-center justify-center">
            <Header />

            <main className="w-full flex-1 pb-16 pt-8">{children}</main>
            <ClientOnly>
              <FeedbackPrompt />
            </ClientOnly>

            <Footer />
          </div>
        </Providers>

        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  );
};

export default RootLayout;
