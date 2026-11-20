'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type MapErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const MapError: FC<MapErrorProps> = ({ error, retry }) => (
  <BoundaryError error={error} retry={retry} />
);

export default MapError;
