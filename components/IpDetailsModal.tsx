import type { LatLngExpression } from 'leaflet';
import { ExternalLinkIcon, LeafIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type FC, useCallback } from 'react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { IpLookupResponse } from '@/app/api/lookupIp/route';

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
  isOpen: boolean;
  onClose: () => void;
};

const IpDetailsModal: FC<IpDetailsModalProps> = ({ ip, isOpen, onClose }) => {
  const { data, error } = useSWR<IpLookupResponse>(
    isOpen ? `/api/lookupIp?ip=${encodeURIComponent(ip)}` : null
  );

  let mappedEntries: {
    label: string;
    value: string;
    type: EntryTypes;
    green?: boolean;
  }[] = [];
  let location: LatLngExpression = [0, 0];

  if (data) {
    mappedEntries = [
      {
        type: EntryTypes.IP,
        label: 'IP',
        value: ip,
        ...(data.greenHosted && { green: true }),
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

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <Dialog modal open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>IP Details for <span className="font-bold tracking-wider">{ip}</span></DialogTitle>
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
                          <>
                            <span>{el.value}</span>
                            {el.type === EntryTypes.Reverse && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Link href={`/lookup/${el.value}`}>
                                      <ExternalLinkIcon className="mx-1 inline-block h-3 w-3 -translate-y-0.5" />
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>View Domain Records</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {el.type === EntryTypes.IP && el.green && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <LeafIcon className="mx-1 inline-block h-3 w-3 -translate-y-0.5 text-green-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Green Hosted</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </>
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
