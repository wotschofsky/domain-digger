import { type FC } from 'react';

const GlobalNotFound: FC = () => (
  <div className="mt-12 flex flex-col items-center gap-2">
    <h2>404 - Not Found</h2>
    <p className="mt-2 text-center text-sm text-muted-foreground">
      This page doesn&apos;t exist
    </p>
  </div>
);

export default GlobalNotFound;
