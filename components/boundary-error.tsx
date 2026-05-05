'use client';

import { type FC, useEffect, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import { parseUserFacingDigest } from '@/lib/user-facing-error';

type BoundaryErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
  fallbackTitle?: string;
};

export const BoundaryError: FC<BoundaryErrorProps> = ({
  error,
  retry,
  fallbackTitle = 'Something went wrong!',
}) => {
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const userFacing = parseUserFacingDigest(error.digest);
  const title = userFacing?.title ?? fallbackTitle;
  const description = userFacing?.description;
  const retryable = userFacing ? (userFacing.retryable ?? false) : true;

  const handleRetry = () => {
    startTransition(() => retry());
  };

  return (
    <div
      className="mt-12 flex flex-col items-center gap-2"
      role="alert"
      aria-live="polite"
    >
      <h2 className="text-xl font-bold">{title}</h2>
      {description && (
        <p className="mt-1 max-w-prose text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {description}
        </p>
      )}
      {retryable && (
        <Button
          variant="outline"
          className="mt-4 min-w-28"
          onClick={handleRetry}
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending && <Spinner className="size-4" aria-hidden="true" />}
          {isPending ? 'Retrying...' : 'Try again'}
        </Button>
      )}
      {!userFacing && error.digest && (
        <p className="mt-2 text-center font-mono text-xs text-zinc-500 dark:text-zinc-400">
          Error Digest: <span className="select-all">{error.digest}</span>
        </p>
      )}
    </div>
  );
};
