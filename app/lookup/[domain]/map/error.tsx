'use client';

import { type FC, useEffect } from 'react';

type MapErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const MapError: FC<MapErrorProps> = ({ error }) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mt-12 flex flex-col items-center gap-2">
      <h2>Something went wrong!</h2>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Digest: {error.digest}
      </p>
    </div>
  );
};

export default MapError;
