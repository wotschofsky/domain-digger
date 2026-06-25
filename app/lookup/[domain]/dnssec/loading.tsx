import { ArrowDownIcon } from 'lucide-react';
import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const DnssecLoading: FC = () => (
  <div className="my-8 space-y-6">
    <Skeleton className="h-20 w-full rounded-xl" />

    <div className="mx-auto flex max-w-xl flex-col items-center">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex w-full flex-col items-center">
          {i > 0 && (
            <ArrowDownIcon className="my-1 size-6 text-zinc-300 dark:text-zinc-700" />
          )}
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ))}
    </div>
  </div>
);

export default DnssecLoading;
