'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

const GlobalError: FC<GlobalErrorProps> = ({ error, unstable_retry }) => (
  <BoundaryError
    error={error}
    retry={unstable_retry}
    fallbackTitle="Something went VERY wrong!"
  />
);

export default GlobalError;
