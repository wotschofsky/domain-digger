'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type DomainErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const DomainError: FC<DomainErrorProps> = ({ error, retry }) => (
  <BoundaryError error={error} retry={retry} />
);

export default DomainError;
