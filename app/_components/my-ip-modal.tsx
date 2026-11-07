'use client';

import { useUserIp } from '@/lib/user-ip';

import { IpDetailsContent } from './ip-details-modal';
import {
  IpAddressRow,
  IpProviderNote,
  MyIpDialog,
  type MyIpModalProps,
} from './my-ip-shared';

const MyIpBody = () => {
  const ipv4 = useUserIp(4, true);
  const ipv6 = useUserIp(6, true);
  return (
    <>
      <div className="grid min-w-0 gap-8 sm:grid-cols-2">
        {([4, 6] as const).map((version) => {
          const result = version === 4 ? ipv4 : ipv6;
          return (
            <section
              key={version}
              aria-label={`IPv${version} details`}
              className="min-w-0"
            >
              <IpAddressRow version={version} result={result} />
              {result.data && (
                <div className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
                  <IpDetailsContent
                    key={result.data}
                    ip={result.data}
                    showAddress={false}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
      <IpProviderNote />
    </>
  );
};

export const MyIpModal = ({ open, onOpenChange }: MyIpModalProps) => (
  <MyIpDialog open={open} onOpenChange={onOpenChange} wide>
    {open && <MyIpBody />}
  </MyIpDialog>
);
