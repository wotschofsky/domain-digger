import type { FC, ReactNode } from 'react';

import { ResolverSelector } from './_components/resolver-selector';

type DnsResultsLayoutProps = {
  children: ReactNode;
};

const DnsResultsLayout: FC<DnsResultsLayoutProps> = async ({ children }) => (
  <>
    <ResolverSelector />
    {children}
  </>
);

export default DnsResultsLayout;
