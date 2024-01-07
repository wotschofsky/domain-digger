import { Skeleton } from '@/components/ui/skeleton';

const WhoisLoading = () => (
  <div className="mt-12 flex justify-center">
    <Skeleton className="my-36 aspect-square w-4/5 rounded-full" />
  </div>
);

export default WhoisLoading;
