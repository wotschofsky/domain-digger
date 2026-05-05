'use client';

import type { FC } from 'react';

import { BoundaryError } from '@/components/boundary-error';

type SubdomainsErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

const SubdomainsError: FC<SubdomainsErrorProps> = ({
  error,
  unstable_retry,
}) => <BoundaryError error={error} retry={unstable_retry} />;

export default SubdomainsError;
