'use client';

import { RotateCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FC, useTransition } from 'react';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

// loading.tsx does not show during router.refresh(), so the button carries its
// own pending state for the fix -> re-check -> re-check operator loop.
export const RecheckButton: FC = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RotateCwIcon
        data-slot="icon"
        className={cn(isPending && 'animate-spin')}
      />
      {isPending ? 'Re-checking…' : 'Re-check'}
    </Button>
  );
};
