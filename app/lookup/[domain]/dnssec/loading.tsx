import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const zones = [
  { nameWidth: 'w-8', keys: 2, ds: 2 },
  { nameWidth: 'w-16', keys: 2, ds: 1 },
  { nameWidth: 'w-36', keys: 1, ds: 1 },
] as const;

const DnssecLoading: FC = () => (
  <div className="space-y-8">
    <p className="sr-only" role="status">
      Loading DNSSEC chain
    </p>
    <div aria-hidden="true" className="space-y-8">
      <header className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-sm" />
        <Skeleton className="h-5 w-full max-w-sm rounded-sm" />
      </header>

      <div className="space-y-4">
        {zones.map((zone, index) => (
          <section
            key={index}
            className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <Skeleton className={`h-7 ${zone.nameWidth} rounded-sm`} />
              <Skeleton className="h-5 w-16 rounded-sm" />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-5 w-20 rounded-sm" />
                {Array.from({ length: zone.keys }).map((_, keyIndex) => (
                  <Skeleton
                    key={keyIndex}
                    className="h-5 w-44 max-w-full rounded-sm"
                  />
                ))}
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-28 rounded-sm" />
                {Array.from({ length: zone.ds }).map((_, dsIndex) => (
                  <div key={dsIndex} className="space-y-1">
                    <Skeleton className="h-5 w-48 max-w-full rounded-sm" />
                    <Skeleton className="h-3 w-36 rounded-sm" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <Skeleton className="h-5 w-full max-w-xl rounded-sm" />
    </div>
  </div>
);

export default DnssecLoading;
