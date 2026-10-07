import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const ExposureLoading: FC = () => (
  <div
    className="mx-auto max-w-4xl space-y-6"
    role="status"
    aria-label="Loading exposure report"
  >
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-16 w-full" />
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  </div>
);

export default ExposureLoading;
