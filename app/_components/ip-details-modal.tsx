'use client';

import type { FC } from 'react';

import {
  ResponsiveDialog,
  type ResponsiveDialogProps,
} from '@/components/responsive-dialog';

import { IpDetails } from './ip-details';

type IpDetailsModalProps = Pick<
  ResponsiveDialogProps,
  'open' | 'onOpenChange'
> & { ip: string };

export const IpDetailsModal: FC<IpDetailsModalProps> = ({ ip, ...props }) => (
  <ResponsiveDialog
    {...props}
    title={`IP Details for ${ip}`}
    description="IP address, reverse DNS, network provider, and approximate location."
  >
    <IpDetails ip={ip} />
  </ResponsiveDialog>
);
