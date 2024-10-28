import type { DialogProps } from '@radix-ui/react-dialog';
import { useWindowSize } from '@uidotdev/usehooks';
import type { LatLngExpression } from 'leaflet';
import naturalCompare from 'natural-compare-lite';
import dynamic from 'next/dynamic';
import { type FC } from 'react';
import useSWRImmutable from 'swr/immutable';

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
import { Spinner } from '@/components/ui/spinner';
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
  },
);

enum EntryTypes {
  IP,
  Reverse,
  Organization,
  ISP,
  Location,
  Coordinates,
  Timezone,
}

type IpDetailsModalProps = {
  ip: string;
  open: DialogProps['open'];
  onOpenChange: DialogProps['onOpenChange'];
};

export const IpDetailsModal: FC<IpDetailsModalProps> = ({
  ip,
  open,
  onOpenChange,
}) => {
  const { width: windowWidth } = useWindowSize();

  const { data, error } = useSWRImmutable<IpLookupResponse>(
    open ? `/api/ip-details?ip=${encodeURIComponent(ip)}` : null,
  );

  let mappedEntries: { label: string; value: string; type: EntryTypes }[] = [];
  let location: LatLngExpression = [0, 0];

  if (data) {
    mappedEntries = [
      {
        type: EntryTypes.IP,
        label: 'IP',
        value: ip,
      },
      ...data.reverse
        .slice()
        .sort(naturalCompare)
        .map((address) => ({
          type: EntryTypes.Reverse,
          label: 'Reverse',
          value: address,
        })),
      {
        type: EntryTypes.Organization,
        label: 'Organization',
        value: data.org,
      },
      {
        type: EntryTypes.ISP,
        label: 'ISP',
        value: data.isp,
      },
      {
        type: EntryTypes.Location,
        label: 'Location',
        value: `${data.country}, ${data.region}, ${data.city}`,
      },
      {
        type: EntryTypes.Coordinates,
        label: 'Coordinates',
        value: `Latitude: ${data.lat}; Longitude: ${data.lon}`,
      },
      {
        type: EntryTypes.Timezone,
        label: 'Timezone',
        value: data.timezone,
      },
    ];

    location = [data.lat, data.lon];
  }

  const title = `IP Details for ${ip}`;
  const content = error ? (
    <p className="my-12 text-center">An error occurred!</p>
  ) : !data ? (
    <div className="flex items-center justify-center">
      <Spinner />
    </div>
  ) : (
    <>
      <Table>
        <TableBody>
          {mappedEntries.map((el) => (
            <TableRow
              key={el.label + el.value}
              className="hover:bg-transparent"
            >
              <TableCell className="pl-0">{el.label}</TableCell>
              <TableCell className="pr-0">
                {el.type === EntryTypes.Reverse ? (
                  <DomainLink domain={el.value} />
                ) : (
                  <>
                    <span>{el.value}</span>
                    {el.type === EntryTypes.IP && (
                      <CopyButton value={el.value} />
                    )}
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="my-4 [&_.leaflet-container]:h-80 [&_.leaflet-container]:w-full">
        <LocationMap location={location} />
      </div>
    </>
  );

  if (windowWidth && windowWidth < 640) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{content}</DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{content}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
