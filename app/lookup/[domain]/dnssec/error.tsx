'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type DnssecErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

const DnssecError: FC<DnssecErrorProps> = ({ error, unstable_retry }) => (
  <BoundaryError error={error} retry={unstable_retry} />
);

export default DnssecError;
