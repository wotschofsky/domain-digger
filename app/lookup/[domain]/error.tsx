'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type DomainErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

const DomainError: FC<DomainErrorProps> = ({ error, unstable_retry }) => (
  <BoundaryError error={error} retry={unstable_retry} />
);

export default DomainError;
