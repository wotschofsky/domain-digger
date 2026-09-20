'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type CertsErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const CertsError: FC<CertsErrorProps> = ({ error, retry }) => (
  <BoundaryError error={error} retry={retry} />
);

export default CertsError;
