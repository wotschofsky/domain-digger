import { type FC, type ReactNode, Suspense } from 'react';

import {
  ResolverSelector,
  ResolverSelectorFallback,
} from './_components/resolver-selector';

type DnsResultsLayoutProps = {
  children: ReactNode;
};

const DnsResultsLayout: FC<DnsResultsLayoutProps> = async ({ children }) => (
  <>
    <Suspense fallback={<ResolverSelectorFallback />}>
      <ResolverSelector />
    </Suspense>
    {children}
  </>
);

export default DnsResultsLayout;
