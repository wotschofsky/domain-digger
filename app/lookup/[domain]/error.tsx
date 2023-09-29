'use client';

import { Loader2 } from 'lucide-react';
import { type FC, useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

type LookupDomainErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const LookupDomainError: FC<LookupDomainErrorProps> = ({ error, reset }) => {
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const handleReset = useCallback(() => {
    setLoading(true);
    reset();
  }, [reset]);

  return (
    <div className="mt-12 flex flex-col items-center gap-2">
      <h2>Something went wrong!</h2>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Digest: {error.digest}
      </p>
      <Button
        className="mt-4"
        onClick={handleReset}
        disabled={isLoading}
        variant="outline"
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Try again
      </Button>
    </div>
  );
};

export default LookupDomainError;
