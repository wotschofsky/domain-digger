'use client';

import { ThemeProvider } from 'next-themes';
import type { FC, ReactNode } from 'react';
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
      <Analytics />
      {children}
    </SWRConfig>
  </ThemeProvider>
);

export default Providers;
