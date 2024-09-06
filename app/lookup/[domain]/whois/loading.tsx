import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const WhoisLoading: FC = () => (
  <div className="mt-12">
    <Skeleton className="mb-4 mt-8 h-9 w-48 rounded-sm" />
    {Array.from({ length: 10 }).map((_, i) => (
      // eslint-disable-next-line react/jsx-key
      <Skeleton className="my-3 h-5 w-full rounded-sm" />
    ))}
  </div>
);

export default WhoisLoading;
