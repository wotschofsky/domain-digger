'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type MapErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const MapError: FC<MapErrorProps> = ({ error, reset }) => (
  <BoundaryError error={error} reset={reset} />
);

export default MapError;
