'use client';

import type { FC, ReactNode } from 'react';
import { SWRConfig } from 'swr';

type ProvidersProps = {
  children: ReactNode;
};

const Providers: FC<ProvidersProps> = ({ children }) => (
  <SWRConfig value={{ fetcher: (url) => fetch(url).then((res) => res.json()) }}>
    {children}
  </SWRConfig>
);

export default Providers;
