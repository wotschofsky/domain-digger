'use client';

// Based on https://github.com/dubinc/dub/blob/03afa158f3c8d5026c9c758883ec2939aa441ba6/packages/ui/src/client-only.tsx
import { type FC, type ReactNode, useEffect, useState } from 'react';

type ClientOnlyProps = {
  children: ReactNode;
};

export const ClientOnly: FC<ClientOnlyProps> = ({ children }) => {
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  return clientReady ? children : null;
};
