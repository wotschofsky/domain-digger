'use client';

import { Spinner } from '@/components/ui/spinner';

export default function Loader() {
  return (
    <div className="flex items-center justify-center">
      <Spinner className="my-8" />
    </div>
  );
}
