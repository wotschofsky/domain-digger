'use client';

import { useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { useAnalytics } from '@/lib/analytics';
import { type IpVersion, useUserIp } from '@/lib/user-ip';

import { IpDetailsContent } from './ip-details-modal';
import {
  IpAddressRow,
  type IpDetection,
  IpProviderNote,
  MyIpDialog,
  type MyIpModalProps,
} from './my-ip-shared';

const SelectedResults = ({
  ipv4,
  ipv6,
}: {
  ipv4: IpDetection;
  ipv6: IpDetection;
}) => {
  // Mount once the first address arrives. Late results never change the selection.
  const [version, setVersion] = useState<IpVersion>(() => (ipv4.data ? 4 : 6));
  const { reportEvent } = useAnalytics();
  const ip = version === 4 ? ipv4.data : ipv6.data;
  return (
    <>
      <div
        className="grid min-w-0 gap-2 sm:grid-cols-2"
        aria-label="Choose address details"
      >
        {([4, 6] as const).map((family) => (
          <IpAddressRow
            key={family}
            version={family}
            result={family === 4 ? ipv4 : ipv6}
            selected={version === family}
            onSelect={() => {
              setVersion(family);
              reportEvent('My IP: Details', { version: family });
            }}
          />
        ))}
      </div>
      <section
        aria-label={`IPv${version} details`}
        className="min-w-0 border-t border-zinc-200 pt-4 dark:border-zinc-700"
      >
        <h3 className="mb-2 text-sm font-medium">IPv{version} details</h3>
        {ip && <IpDetailsContent key={ip} ip={ip} showAddress={false} />}
      </section>
    </>
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
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <IpAddressRow version={4} result={ipv4} />
            <IpAddressRow version={6} result={ipv6} />
          </div>
          {(ipv4.isValidating || ipv6.isValidating) && (
            <Skeleton className="h-48 w-full" />
          )}
        </>
      )}
      <IpProviderNote />
    </>
  );
};

export const MyIpModal = ({ open, onOpenChange }: MyIpModalProps) => (
  <MyIpDialog open={open} onOpenChange={onOpenChange}>
    {open && <MyIpBody />}
  </MyIpDialog>
);
