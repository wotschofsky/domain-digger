import { Skeleton } from '@/components/ui/skeleton';

const WhoisLoading = () => (
  <div className="mt-12">
    <Skeleton className="mb-4 mt-8 h-9 w-48 rounded-sm" />
    {Array.from({ length: 10 }).map((_, i) => (
      <Skeleton className="my-3 h-5 w-full rounded-sm" key={i} />
    ))}
  </div>
);

export default WhoisLoading;
