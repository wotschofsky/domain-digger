import { type FC, Fragment } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const DomainError: FC = () => (
  <div className="mt-12">
    {Array.from({ length: 3 }).map((_, i) => (
      <Fragment key={i}>
        <Skeleton className="mb-4 mt-8 h-7 w-16 rounded-sm" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton className="my-3 h-5 w-full rounded-sm" key={i} />
        ))}
      </Fragment>
    ))}
  </div>
);

export default DomainError;
