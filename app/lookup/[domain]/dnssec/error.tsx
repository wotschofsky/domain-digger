'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type DnssecErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const DnssecError: FC<DnssecErrorProps> = ({ error, retry }) => (
  <BoundaryError error={error} retry={retry} />
);

export default DnssecError;
