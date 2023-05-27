import type { ReactNode } from 'react';

import Footer from '@/components/Footer';
import Header from '@/components/Header';

import './globals.css';
import Providers from './providers';

type RootLayoutProps = {
  children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <div className="flex min-h-screen flex-col items-center justify-center">
            <Header />

            <div className="w-full flex-1">{children}</div>

            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
};

export default RootLayout;
