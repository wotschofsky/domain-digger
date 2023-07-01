import { Rubik } from 'next/font/google';
import type { FC, ReactNode } from 'react';

import Footer from '@/components/Footer';
import Header from '@/components/Header';

import './globals.css';
import Providers from './providers';

const rubik = Rubik({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'digga: Domain- & Infrastructure research',
  description:
    'digga is the easy but incredibly powerful tool for full domain and infrastructure research.',
};

type RootLayoutProps = {
  children: ReactNode;
};

const RootLayout: FC<RootLayoutProps> = ({ children }) => {
  return (
    <html lang="en" suppressHydrationWarning className={rubik.className}>
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
