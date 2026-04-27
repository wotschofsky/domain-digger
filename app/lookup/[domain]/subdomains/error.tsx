'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type SubdomainsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const SubdomainsError: FC<SubdomainsErrorProps> = ({ error, reset }) => (
  <BoundaryError error={error} reset={reset} />
);

export default SubdomainsError;
