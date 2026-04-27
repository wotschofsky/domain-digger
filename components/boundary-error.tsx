'use client';

import { type FC, useEffect } from 'react';

import { Button } from '@/components/ui/button';

import { parseUserFacingError } from '@/lib/user-facing-error';

type BoundaryErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  fallbackTitle?: string;
};

export const BoundaryError: FC<BoundaryErrorProps> = ({
  error,
  reset,
  fallbackTitle = 'Something went wrong!',
}) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const userFacing = parseUserFacingError(error.message);

  const title = userFacing?.title ?? fallbackTitle;
  const description = userFacing?.description;
  const canRetry = userFacing?.retryable ?? false;

  return (
    <div className="mt-12 flex flex-col items-center gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 max-w-prose text-center text-zinc-600 dark:text-zinc-300">
          {description}
        </p>
      )}
      {canRetry && (
        <Button variant="outline" className="mt-4" onClick={() => reset()}>
          Try again
        </Button>
      )}
      {error.digest && (
        <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Digest: {error.digest}
        </p>
      )}
    </div>
  );
};
