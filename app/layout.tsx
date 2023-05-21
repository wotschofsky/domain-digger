'use client';

import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import Footer from '@/components/Footer';
import Header from '@/components/Header';

import './globals.css';

// export const metadata = {
//   title: 'Domain Digger',
// };

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="en">
      <body>
        <ColorModeScript initialColorMode="system" />
        <SWRConfig
          value={{ fetcher: (url) => fetch(url).then((res) => res.json()) }}
        >
          <ChakraProvider>
            <div className="flex min-h-screen flex-col items-center justify-center">
              <Header />

              <div className="w-full flex-1">{children}</div>

              <Footer />
            </div>
          </ChakraProvider>
        </SWRConfig>
      </body>
    </html>
  );
};

export default RootLayout;
