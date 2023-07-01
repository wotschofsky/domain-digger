import type { DialogProps } from '@radix-ui/react-dialog';
import type { LatLngExpression } from 'leaflet';
import dynamic from 'next/dynamic';
import { type FC } from 'react';
import useSWR from 'swr';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

import type { IpLookupResponse } from '@/app/api/lookupIp/route';
import DomainLink from '@/components/DomainLink';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
});

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

const IpDetailsModal: FC<IpDetailsModalProps> = ({
  ip,
  open,
  onOpenChange,
}) => {
  const { data, error } = useSWR<IpLookupResponse>(
    open ? `/api/lookupIp?ip=${encodeURIComponent(ip)}` : null
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
        .sort()
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

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            IP Details for <span className="font-extrabold">{ip}</span>
          </DialogTitle>
          <DialogDescription>
            {!data ? (
              <div className="flex items-center justify-center">
                <Spinner />
              </div>
            ) : error ? (
              <p>An error occurred!</p>
            ) : (
              <>
                <Table>
                  <TableBody>
                    {mappedEntries.map((el) => (
                      <TableRow key={el.label + el.value}>
                        <TableCell className="pl-0">{el.label}</TableCell>
                        <TableCell className="pr-0">
                          {el.type === EntryTypes.Reverse ? (
                            <DomainLink domain={el.value} />
                          ) : (
                            <span>{el.value}</span>
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
            )}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default IpDetailsModal;
