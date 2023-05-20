'use client';

import {
  chakra,
  ChakraProvider,
  ColorModeScript,
  Flex,
} from '@chakra-ui/react';
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
            <Flex
              minH="100vh"
              direction="column"
              align="center"
              justify="center"
            >
              <Header />

              <chakra.div width="100%" flex={1}>
                {children}
              </chakra.div>

              <Footer />
            </Flex>
          </ChakraProvider>
        </SWRConfig>
      </body>
    </html>
  );
};

export default RootLayout;
