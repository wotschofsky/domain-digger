'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

const ExposureError: FC<{
  error: Error & { digest?: string };
  retry: () => void;
}> = ({ error, retry }) => <BoundaryError error={error} retry={retry} />;

export default ExposureError;
