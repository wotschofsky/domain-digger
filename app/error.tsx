'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const GlobalError: FC<GlobalErrorProps> = ({ error, retry }) => (
  <BoundaryError
    error={error}
    retry={retry}
    fallbackTitle="Something went VERY wrong!"
  />
);

export default GlobalError;
