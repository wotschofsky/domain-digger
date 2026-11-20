'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type WhoisErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const WhoisError: FC<WhoisErrorProps> = ({ error, retry }) => (
  <BoundaryError error={error} retry={retry} />
);

export default WhoisError;
