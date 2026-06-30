import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const DnssecLoading: FC = () => (
  <div>
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex-1">
        <Skeleton className="h-7 w-72 max-w-full rounded-sm" />
        <Skeleton className="mt-2 h-4 w-full max-w-prose rounded-sm" />
      </div>
      <Skeleton className="h-7 w-24 rounded-full" />
    </div>

    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i}>
        {i > 0 && (
          <div className="flex justify-center py-2.5">
            <Skeleton className="h-4 w-32 rounded-sm" />
          </div>
        )}
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
    ))}
  </div>
);

export default DnssecLoading;
