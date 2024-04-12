import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

const MapLoading: FC = () => (
  <div className="mt-12 flex justify-center">
    <Skeleton className="my-36 aspect-square w-3/5 rounded-full" />
  </div>
);

export default MapLoading;
