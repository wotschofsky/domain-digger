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

  const title = `IP Details for ${ip}`;
  const content = (() => {
    if (error) {
      return <p className="my-12 text-center">An error occurred!</p>;
    }

    if (!data) {
      return (
        <div className="flex items-center justify-center">
          <Spinner className="my-8" />
        </div>
      );
    }

    const mappedEntries = [
      {
        label: 'IP',
        component: (
          <>
            <span>{ip}</span>
            <CopyButton value={ip} />
          </>
        ),
      },
      ...data.reverse
        .slice()
        .sort(naturalCompare)
        .map((address) => ({
          label: 'Reverse',
          component: <DomainLink domain={address} />,
        })),
      ...addIf(!!data.org, {
        label: 'Organization',
        component: <span>{data.org}</span>,
      }),
      ...addIf(!!data.isp, {
        label: 'ISP',
        component: <span>{data.isp}</span>,
      }),
      ...addIf(!!data.country || !!data.region || !!data.city, {
        label: 'Location',
        component: (
          <span>
            {[data.country, data.region, data.city].filter(Boolean).join(', ')}
          </span>
        ),
      }),
      ...addIf(!!data.lat && !!data.lon, {
        label: 'Coordinates',
        component: (
          <span>{`Latitude: ${data.lat}; Longitude: ${data.lon}`}</span>
        ),
      }),
      ...addIf(!!data.timezone, {
        label: 'Timezone',
        component: <span>{data.timezone}</span>,
      }),
    ];

    const location =
      data.lat && data.lon ? ([data.lat, data.lon] as LatLngTuple) : null;

    return (
      <>
        <Table>
          <TableBody>
            {mappedEntries.map((el) => (
              <TableRow key={el.label} className="hover:bg-transparent">
                <TableCell className="pl-0">{el.label}</TableCell>
                <TableCell className="wrap-break-words pr-0 whitespace-normal">
                  {el.component}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {location && (
          <div className="my-4 [&_.leaflet-container]:h-80 [&_.leaflet-container]:w-full">
            <LocationMap location={location} />
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

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
const addIf = <T extends unknown>(condition: boolean, value: T): T[] =>
  condition ? [value] : [];
