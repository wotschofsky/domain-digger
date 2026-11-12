'use client';

import naturalCompare from 'natural-compare-lite';
import dynamic from 'next/dynamic';
import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

import { useIpDetails } from '@/app/api/ip-details/hook';
import { UserFacingError } from '@/lib/user-facing-error';
import { cn } from '@/lib/utils';

import { CopyButton } from './copy-button';
import { DomainLink } from './domain-link';

const LocationMap = dynamic(
  () => import('./location-map').then((module) => module.LocationMap),
  {
    ssr: false,
    loading: () => <Skeleton className="size-full rounded-none" />,
  },
);

type IpDetailsProps = {
  ip: string;
  className?: string;
};

export const IpDetails: FC<IpDetailsProps> = ({ ip, className }) => {
  const { data, error } = useIpDetails(ip);
  const fields = [
    {
      label: 'IP',
      value: (
        <>
          <span>{ip}</span>
          <CopyButton value={ip} />
        </>
      ),
    },
    {
      label: 'Reverse',
      value: data?.reverse.length ? (
        data.reverse.toSorted(naturalCompare).map((domain, index) => (
          <span key={domain}>
            <DomainLink domain={domain} />
            {index < data.reverse.length - 1 && ', '}
          </span>
        ))
      ) : (
        <span className="italic">not configured</span>
      ),
    },
    { label: 'Organization', value: data?.org },
    { label: 'ISP', value: data?.isp },
    {
      label: 'Location',
      value:
        data &&
        [data.country, data.region, data.city].filter(Boolean).join(', '),
    },
    {
      label: 'Coordinates',
      value:
        data?.lat != null && data.lon != null
          ? `Latitude: ${data.lat}; Longitude: ${data.lon}`
          : undefined,
    },
    { label: 'Timezone', value: data?.timezone },
    // A failed lookup still shows the address and its copy button.
  ].filter(({ label }) => !error || label === 'IP');
  const location =
    data?.lat != null && data.lon != null
      ? ([data.lat, data.lon] as [number, number])
      : null;

  return (
    <div className={cn('min-w-0 space-y-4', className)}>
      <Table>
        <TableBody>
          {fields.map(({ label, value }) => (
            <TableRow key={label} className="hover:bg-transparent">
              <th scope="row" className="p-2 pl-0 text-left font-normal">
                {label}
              </th>
              <TableCell className="pr-0 wrap-anywhere whitespace-normal">
                {!data && label !== 'IP' ? (
                  <Skeleton className="inline-block h-4 w-48 max-w-full" />
                ) : (
                  value || <span className="italic">unknown</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {error && (
        <div className="py-12 text-center" role="alert">
          <p>
            {error instanceof UserFacingError
              ? error.payload.title
              : 'An error occurred!'}
          </p>
          {error instanceof UserFacingError && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {error.payload.description}
            </p>
          )}
        </div>
      )}
      {!error && (!data || location) && (
        <div className="h-80 w-full [&_.leaflet-container]:size-full">
          {location ? (
            <LocationMap key={location.join(',')} location={location} />
          ) : (
            <Skeleton className="size-full rounded-none" />
          )}
        </div>
      )}
    </div>
  );
};
