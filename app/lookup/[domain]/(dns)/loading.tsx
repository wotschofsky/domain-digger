import { type FC, Fragment } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const DomainError: FC = () => (
  <div className="mt-12">
    {Array.from({ length: 3 }).map((_, i) => (
      <Fragment key={i}>
        <Skeleton className="mt-8 mb-4 h-7 w-16 rounded-sm" />
        {Array.from({ length: 3 }).map((_, j) => (
          <Skeleton key={j} className="my-3 h-5 w-full rounded-sm" />
        ))}
      </Fragment>
    ))}
  </div>
);

export default DomainError;
