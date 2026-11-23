'use client';

import { type FC, type ReactNode, useSyncExternalStore } from 'react';

type ClientOnlyProps = {
  children: ReactNode;
};

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export const ClientOnly: FC<ClientOnlyProps> = ({ children }) => {
  const clientReady = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  return clientReady ? children : null;
};
