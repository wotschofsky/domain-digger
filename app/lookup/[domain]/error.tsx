'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type DomainErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const DomainError: FC<DomainErrorProps> = ({ error, reset }) => (
  <BoundaryError error={error} reset={reset} />
);

export default DomainError;
