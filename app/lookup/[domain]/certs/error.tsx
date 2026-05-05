'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type CertsErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

const CertsError: FC<CertsErrorProps> = ({ error, unstable_retry }) => (
  <BoundaryError error={error} retry={unstable_retry} />
);

export default CertsError;
