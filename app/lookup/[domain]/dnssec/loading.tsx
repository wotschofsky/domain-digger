import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const DnssecLoading: FC = () => (
  <div>
    <Skeleton className="h-6 w-64 rounded-sm" />
    <Skeleton className="mt-2 h-4 w-full max-w-2xl rounded-sm" />

    {Array.from({ length: 3 }).map((_, i) => (
      <section key={i}>
        <Skeleton className="mt-12 mb-1 h-7 w-40 rounded-sm" />
        <Skeleton className="mb-4 h-4 w-80 max-w-full rounded-sm" />
        <Skeleton className="h-24 w-full rounded-sm" />
      </section>
    ))}
  </div>
);

export default DnssecLoading;
