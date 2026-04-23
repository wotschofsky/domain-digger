'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type WhoisErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const WhoisError: FC<WhoisErrorProps> = ({ error, reset }) => (
  <BoundaryError error={error} reset={reset} />
);

export default WhoisError;
