'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  ResponsiveDialog,
  type ResponsiveDialogProps,
} from '@/components/responsive-dialog';
import { useAnalytics } from '@/lib/analytics';
import { shortenIp } from '@/lib/ip-display';
import {
  IP_VERSIONS,
  type IpDetection,
  type IpVersion,
  useUserIp,
} from '@/lib/user-ip';

import { IpDetails } from './ip-details';

type Results = { ipv4: IpDetection; ipv6: IpDetection };

const AddressTabs = ({ ipv4, ipv6 }: Results) => (
  <TabsList
    aria-label="IP address details"
    className="grid h-auto w-full grid-cols-2 gap-4 rounded-none border-b border-zinc-200 bg-transparent p-0 dark:border-zinc-700"
  >
    {IP_VERSIONS.map((version) => {
      const result = version === 4 ? ipv4 : ipv6;
      const status = result.data
        ? shortenIp(result.data)
        : result.error && !result.isValidating
          ? 'Not detected'
          : 'Checking…';
      return (
        <TabsTrigger
          key={version}
          value={String(version)}
          disabled={!result.data}
          title={result.data}
          aria-label={`IPv${version} (${result.data ?? status})`}
          className="min-w-0 gap-1 rounded-none border-b-2 border-transparent px-1 py-3 data-[state=active]:border-zinc-950 data-[state=active]:bg-transparent data-[state=active]:text-zinc-950 data-[state=active]:shadow-none dark:data-[state=active]:border-white dark:data-[state=active]:text-white"
        >
          <span className="shrink-0">IPv{version}</span>
          <span className="truncate font-normal">({status})</span>
        </TabsTrigger>
      );
    })}
  </TabsList>
);

const SelectedResults = ({ ipv4, ipv6 }: Results) => {
  // Mount once the first address arrives. Late results never change the selection.
  const [version, setVersion] = useState<IpVersion>(() => (ipv4.data ? 4 : 6));
  const { reportEvent } = useAnalytics();
  return (
    <Tabs
      value={String(version)}
      onValueChange={(value) => {
        const next = value === '4' ? 4 : 6;
        setVersion(next);
        reportEvent('My IP: Details', { version: next });
      }}
      className="min-w-0"
    >
      <AddressTabs ipv4={ipv4} ipv6={ipv6} />
      {IP_VERSIONS.map((family) => {
        const ip = family === 4 ? ipv4.data : ipv6.data;
        return (
          <TabsContent
            key={family}
            value={String(family)}
            className="mt-4 min-w-0"
          >
            {ip && <IpDetails key={ip} ip={ip} />}
          </TabsContent>
        );
      })}
    </Tabs>
  );
};

const MyIpBody = () => {
  const ipv4 = useUserIp(4, true);
  const ipv6 = useUserIp(6, true);
  return (
    <>
      {ipv4.data || ipv6.data ? (
        <SelectedResults ipv4={ipv4} ipv6={ipv6} />
      ) : (
        <Tabs value="">
          <AddressTabs ipv4={ipv4} ipv6={ipv6} />
          {(ipv4.isValidating || ipv6.isValidating) && (
            <Skeleton className="mt-4 h-48 w-full" />
          )}
        </Tabs>
      )}
      <IpRetryNotice version={4} result={ipv4} />
      <IpRetryNotice version={6} result={ipv6} />
      <IpProviderNote />
    </>
  );
};

export const MyIpModal = (
  props: Pick<ResponsiveDialogProps, 'open' | 'onOpenChange'>,
) => (
  <ResponsiveDialog
    {...props}
    title="Your IP addresses"
    description="Your public IPv4 and IPv6 addresses and network details."
  >
    <MyIpBody />
  </ResponsiveDialog>
);

const IpRetryNotice = ({
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
          void result.retry();
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
          onClick={() => {
            void result.tryAlternative();
          }}
        >
          Try ident.me
        </Button>
      )}
    </div>
  );
};

const IpProviderNote = () => (
  <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
