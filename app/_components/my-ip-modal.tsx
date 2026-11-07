'use client';

import { useUserIp } from '@/lib/user-ip';

import {
  IpAddressRow,
  IpProviderNote,
  MyIpDialog,
  type MyIpModalProps,
} from './my-ip-shared';
import { MyIpSummary } from './my-ip-summary';

const MyIpBody = () => {
  const ipv4 = useUserIp(4, true);
  const ipv6 = useUserIp(6, true);
  return (
    <>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <IpAddressRow version={4} result={ipv4} />
        <IpAddressRow version={6} result={ipv6} />
      </div>
      {(ipv4.data || ipv6.data) && (
        <MyIpSummary ipv4={ipv4.data} ipv6={ipv6.data} />
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
