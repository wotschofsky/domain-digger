'use client';

import { ThemeProvider } from 'next-themes';
import { type FC, type ReactNode, Suspense } from 'react';
import { SWRConfig } from 'swr';

import Analytics from '@/components/Analytics';

type ProvidersProps = {
  children: ReactNode;
};

const Providers: FC<ProvidersProps> = ({ children }) => (
  <ThemeProvider attribute="class">
    <SWRConfig
      value={{ fetcher: (url) => fetch(url).then((res) => res.json()) }}
    >
      <Suspense>
        <Analytics />
      </Suspense>

      {children}
    </SWRConfig>
  </ThemeProvider>
);

export default Providers;
