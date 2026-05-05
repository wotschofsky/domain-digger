'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type MapErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

const MapError: FC<MapErrorProps> = ({ error, unstable_retry }) => (
  <BoundaryError error={error} retry={unstable_retry} />
);

export default MapError;
