import type { FC, ReactNode } from 'react';

import Footer from '@/components/Footer';
import Header from '@/components/Header';

import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Domain Digger: DNS, WHOIS lookup & more',
  description:
    'Domain Digger is the easy but incredibly powerful tool for looking up and quickly inspecting DNS records, WHOIS data, SSL/TLS certificate history and other domain related data. No installation required!',
  openGraph: {
    title: 'Domain Digger: DNS, WHOIS lookup & more',
    description:
      'Domain Digger is the easy but incredibly powerful tool for looking up and quickly inspecting DNS records, WHOIS data, SSL/TLS certificate history and other domain related data. No installation required!',
    url: process.env.SITE_URL,
  },
  alternates: {
    canonical: process.env.SITE_URL,
  },
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

            <main className="w-full flex-1">{children}</main>

            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
};

export default RootLayout;
