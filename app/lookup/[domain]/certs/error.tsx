'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type CertsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const CertsError: FC<CertsErrorProps> = ({ error, reset }) => (
  <BoundaryError error={error} reset={reset} />
);

export default CertsError;
