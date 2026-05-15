import type { DialogProps } from '@radix-ui/react-dialog';
import { useWindowSize } from '@uidotdev/usehooks';
import type { LatLngTuple } from 'leaflet';
import naturalCompare from 'natural-compare-lite';
import dynamic from 'next/dynamic';
import type { FC } from 'react';
import useSWRImmutable from 'swr/immutable';

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
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

import type { IpLookupResponse } from '@/app/api/ip-details/route';

import { CopyButton } from './copy-button';
import { DomainLink } from './domain-link';

const LocationMap = dynamic(
  () =>
    import('./location-map').then((m) => ({
      default: m.LocationMap,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="size-full rounded-none" />,
  },
);

type IpDetailsModalProps = {
  ip: string;
  open: DialogProps['open'];
  onOpenChange: DialogProps['onOpenChange'];
};

const renderField = (
  value: string | null | undefined,
  skeletonClassName: string,
  isLoading: boolean,
) =>
  isLoading ? (
    <Skeleton className={`inline-block h-4 ${skeletonClassName}`} />
  ) : (
    value || <span className="italic">unknown</span>
  );

export const IpDetailsModal: FC<IpDetailsModalProps> = ({
  ip,
  open,
  onOpenChange,
}) => {
  const { width: windowWidth } = useWindowSize();

  const { data, error } = useSWRImmutable<IpLookupResponse>(
    open ? `/api/ip-details?ip=${encodeURIComponent(ip)}` : null,
  );

  const title = `IP Details for ${ip}`;
  const content = (() => {
    if (error) {
      return <p className="my-12 text-center">An error occurred!</p>;
    }

    const isLoading = !data;
    const reverse = data?.reverse.slice().sort(naturalCompare) ?? [];
    const locationText = data
      ? [data.country, data.region, data.city].filter(Boolean).join(', ')
      : '';

    const coordinatesText =
      data?.lat != null && data.lon != null
        ? `Latitude: ${data.lat}; Longitude: ${data.lon}`
        : '';

    const entries = [
      {
        label: 'IP',
        component: (
          <>
            <span>{ip}</span>
            <CopyButton value={ip} />
          </>
        ),
      },
      {
        label: 'Reverse',
        component: isLoading ? (
          <Skeleton className="inline-block h-4 w-64" />
        ) : reverse.length ? (
          reverse.map((address, index) => (
            <span key={address}>
              <DomainLink domain={address} />
              {index < reverse.length - 1 && ', '}
            </span>
          ))
        ) : (
          <span className="italic">not configured</span>
        ),
      },
      {
        label: 'Organization',
        component: renderField(data?.org, 'w-48', isLoading),
      },
      {
        label: 'ISP',
        component: renderField(data?.isp, 'w-24', isLoading),
      },
      {
        label: 'Location',
        component: renderField(locationText || null, 'w-56', isLoading),
      },
      {
        label: 'Coordinates',
        component: renderField(coordinatesText || null, 'w-60', isLoading),
      },
      {
        label: 'Timezone',
        component: renderField(data?.timezone, 'w-32', isLoading),
      },
    ];

    const location =
      data?.lat != null && data.lon != null
        ? ([data.lat, data.lon] as LatLngTuple)
        : null;

    return (
      <>
        <Table>
          <TableBody>
            {entries.map((el) => (
              <TableRow key={el.label} className="hover:bg-transparent">
                <TableCell className="pl-0">{el.label}</TableCell>
                <TableCell className="pr-0 wrap-anywhere whitespace-normal">
                  {el.component}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {(isLoading || location) && (
          <div className="my-4 h-80 w-full [&_.leaflet-container]:size-full">
            {isLoading ? (
              <Skeleton className="size-full rounded-none" />
            ) : location ? (
              <LocationMap location={location} />
            ) : null}
          </div>
        )}
      </>
    );
  })();

  if (windowWidth && windowWidth < 640) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};
