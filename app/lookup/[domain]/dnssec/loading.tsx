import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const DnssecLoading: FC = () => (
  <div className="space-y-6">
    {/* Verdict header */}
    <div className="rounded-lg border border-zinc-950/10 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start gap-3 [&>svg~*]:pl-7">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-28 rounded-sm" />
          <Skeleton className="mt-2 h-4 w-3/4 rounded-sm" />
        </div>
      </div>
    </div>

    {/* Trust rail */}
    <div>
      <Skeleton className="mb-3 h-4 w-48 rounded-sm" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 pb-6 sm:gap-4">
          <div className="flex w-5 flex-col items-center sm:w-6">
            <Skeleton className="mt-3.5 size-3 rounded-full" />
            {i < 2 && <Skeleton className="my-1 h-24 w-px flex-1" />}
          </div>
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-40 rounded-sm" />
            <Skeleton className="h-4 w-24 rounded-sm" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((__, j) => (
                <Skeleton key={j} className="h-28 w-full rounded-md" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default DnssecLoading;
