'use client';

import { useWindowSize } from '@uidotdev/usehooks';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

import type { IpVersion, useUserIp } from '@/lib/user-ip';

export type IpDetection = ReturnType<typeof useUserIp>;
export type MyIpModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const IpRetryNotice = ({
  version,
  result,
}: {
  version: IpVersion;
  result: IpDetection;
}) => {
  if (result.data || !result.error || result.isValidating) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"
      role="status"
    >
      <span>IPv{version} not detected.</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Retry IPv${version}`}
        onClick={() => {
          void result.mutate().catch(() => {});
        }}
      >
        Retry
      </Button>
      {result.provider === 'icanhazip' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Use ident.me for IPv${version}`}
          onClick={result.tryAlternative}
        >
          Try ident.me
        </Button>
      )}
    </div>
  );
};

export const IpProviderNote = () => (
  <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
    Detection by{' '}
    <a
      href="https://icanhazip.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      icanhazip
    </a>
    . Your browser connects directly. If a check fails, you can try{' '}
    <a
      href="https://api.ident.me/"
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      ident.me
    </a>
    . A failed check can also mean the service is unreachable.
  </p>
);

export const MyIpDialog = ({
  open,
  onOpenChange,
  children,
  wide = false,
}: MyIpModalProps & { children: ReactNode; wide?: boolean }) => {
  const { width } = useWindowSize();
  if (width && width < 640)
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90dvh] overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Your IP addresses</DrawerTitle>
            <DrawerDescription className="sr-only">
              Your public IPv4 and IPv6 addresses and network details.
            </DrawerDescription>
          </DrawerHeader>
          {children}
        </DrawerContent>
      </Drawer>
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={wide ? 'sm:max-w-4xl' : undefined}>
        <DialogHeader>
          <DialogTitle>Your IP addresses</DialogTitle>
          <DialogDescription className="sr-only">
            Your public IPv4 and IPv6 addresses and network details.
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};
