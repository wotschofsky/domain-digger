'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type WhoisErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

const WhoisError: FC<WhoisErrorProps> = ({ error, unstable_retry }) => (
  <BoundaryError error={error} retry={unstable_retry} />
);

export default WhoisError;
