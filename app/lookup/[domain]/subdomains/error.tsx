'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type SubdomainsErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const SubdomainsError: FC<SubdomainsErrorProps> = ({ error, retry }) => (
  <BoundaryError error={error} retry={retry} />
);

export default SubdomainsError;
