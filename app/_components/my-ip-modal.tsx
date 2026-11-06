'use client';

import { useWindowSize } from '@uidotdev/usehooks';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';

import { useAnalytics } from '@/lib/analytics';
import { type IpVersion, useUserIp } from '@/lib/user-ip';

import { CopyButton } from './copy-button';
import { IpDetailsContent } from './ip-details-modal';

const AddressRow = ({
  version,
  enabled,
  onSelect,
}: {
  version: IpVersion;
  enabled: boolean;
  onSelect: (ip: string) => void;
}) => {
  const { data, error, isValidating, mutate } = useUserIp(version, enabled);

  return (
    <div className="space-y-2 border-b border-zinc-200 py-4 dark:border-zinc-700">
      <h3 className="text-sm font-medium">IPv{version}</h3>
      <div
        className="flex items-center justify-between gap-3"
        aria-live="polite"
      >
        {data ? (
          <>
            <span className="min-w-0 font-mono text-sm break-all">
              {data}
              <CopyButton value={data} />
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelect(data)}
              aria-label={`IPv${version} details`}
            >
              Details
            </Button>
          </>
        ) : isValidating || !error ? (
          <>
            <Skeleton className="h-5 w-48" />
            <span className="sr-only">Detecting IPv{version}</span>
          </>
        ) : (
          <>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Not detected
            </span>
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
          </>
        )}
      </div>
    </div>
  );
};

export const MyIpModal = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { width } = useWindowSize();
  const { reportEvent } = useAnalytics();
  const [selected, setSelected] = useState<{
    ip: string;
    version: IpVersion;
  } | null>(null);
  const changeOpen = (next: boolean) => {
    if (!next) setSelected(null);
    onOpenChange(next);
  };
  const content = open ? (
    <>
      {([4, 6] as const).map((version) => (
        <AddressRow
          key={version}
          version={version}
          enabled={open}
          onSelect={(ip) => {
            setSelected({ ip, version });
            reportEvent('My IP: Details', { version });
          }}
        />
      ))}
      <p className="my-3 text-xs text-zinc-500 dark:text-zinc-400">
        Detection by{' '}
        <a
          href="https://api.ident.me/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          ident.me
        </a>
        . Your browser connects directly to identify each public address. A
        failed check can also mean the service is unreachable.
      </p>
      {selected && (
        <section aria-label={`IPv${selected.version} details`}>
          <h3 className="mt-4 mb-2 text-sm font-medium">
            IPv{selected.version} details
          </h3>
          <IpDetailsContent key={selected.ip} ip={selected.ip} />
        </section>
      )}
    </>
  ) : null;

  if (width && width < 640)
    return (
      <Drawer open={open} onOpenChange={changeOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Your IP addresses</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your IP addresses</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};
