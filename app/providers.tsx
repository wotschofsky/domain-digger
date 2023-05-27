'use client';

import { ThemeProvider } from 'next-themes';
import type { FC, ReactNode } from 'react';
import { SWRConfig } from 'swr';

type ProvidersProps = {
  children: ReactNode;
};

const Providers: FC<ProvidersProps> = ({ children }) => (
  <ThemeProvider attribute="class">
    <SWRConfig
      value={{ fetcher: (url) => fetch(url).then((res) => res.json()) }}
    >
      {children}
    </SWRConfig>
  </ThemeProvider>
);

export default Providers;
