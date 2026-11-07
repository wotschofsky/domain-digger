'use client';

import { useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAnalytics } from '@/lib/analytics';
import { shortenIp } from '@/lib/ip-display';
import { type IpVersion, useUserIp } from '@/lib/user-ip';

import { IpDetailsContent } from './ip-details-modal';
import {
  type IpDetection,
  IpProviderNote,
  IpRetryNotice,
  MyIpDialog,
  type MyIpModalProps,
} from './my-ip-shared';

type Results = { ipv4: IpDetection; ipv6: IpDetection };

const AddressTabs = ({ ipv4, ipv6 }: Results) => (
  <TabsList
    aria-label="IP address details"
    className="grid h-auto w-full grid-cols-2 gap-4 rounded-none border-b border-zinc-200 bg-transparent p-0 dark:border-zinc-700"
  >
    {([4, 6] as const).map((version) => {
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
      {([4, 6] as const).map((family) => {
        const ip = family === 4 ? ipv4.data : ipv6.data;
        return (
          <TabsContent
            key={family}
            value={String(family)}
            className="mt-4 min-w-0"
          >
            {ip && <IpDetailsContent key={ip} ip={ip} />}
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

export const MyIpModal = ({ open, onOpenChange }: MyIpModalProps) => (
  <MyIpDialog open={open} onOpenChange={onOpenChange}>
    {open && <MyIpBody />}
  </MyIpDialog>
);
