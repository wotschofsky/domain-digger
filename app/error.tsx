'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const GlobalError: FC<GlobalErrorProps> = ({ error, reset }) => (
  <BoundaryError
    error={error}
    reset={reset}
    fallbackTitle="Something went VERY wrong!"
  />
);

export default GlobalError;
