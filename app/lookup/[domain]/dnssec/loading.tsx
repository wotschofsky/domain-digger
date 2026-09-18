import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const DnssecLoading: FC = () => (
  <div className="mt-12 space-y-4">
    <Skeleton className="h-9 w-48 rounded-sm" />
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-36 w-full rounded-sm" />
    ))}
  </div>
);

export default DnssecLoading;
