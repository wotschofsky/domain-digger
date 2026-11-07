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
import { Skeleton } from '@/components/ui/skeleton';

import type { IpVersion, useUserIp } from '@/lib/user-ip';
import { cn } from '@/lib/utils';

import { CopyButton } from './copy-button';

export type IpDetection = ReturnType<typeof useUserIp>;
export type MyIpModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const IpAddressRow = ({
  version,
  result,
  selected,
  onSelect,
}: {
  version: IpVersion;
  result: IpDetection;
  selected?: boolean;
  onSelect?: () => void;
}) => {
  const { data, error, isValidating, mutate, provider, tryAlternative } =
    result;
  const address = (
    <>
      <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        IPv{version}
      </span>
      <span className="block min-w-0 font-mono text-sm break-all">{data}</span>
    </>
  );
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-lg py-3',
        onSelect && 'px-3',
        selected && 'bg-zinc-100 dark:bg-zinc-800',
      )}
      aria-live="polite"
    >
      {data ? (
        <>
          {onSelect ? (
            <button
              type="button"
              onClick={onSelect}
              aria-pressed={selected}
              aria-label={`Show IPv${version} details`}
              className="min-w-0 flex-1 cursor-pointer rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
            >
              {address}
            </button>
          ) : (
            <div className="min-w-0 flex-1">{address}</div>
          )}
          <CopyButton value={data} />
        </>
      ) : (
        <div className="min-w-0 flex-1 space-y-2">
          <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            IPv{version}
          </span>
          {isValidating || !error ? (
            <>
              <Skeleton className="h-5 w-full max-w-48" />
              <span className="sr-only">Detecting IPv{version}</span>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Not detected
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Retry IPv${version}`}
                  onClick={() => {
                    void mutate().catch(() => {});
                  }}
                >
                  Retry
                </Button>
                {provider === 'icanhazip' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Use ident.me for IPv${version}`}
                    onClick={tryAlternative}
                  >
                    Try ident.me
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
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
