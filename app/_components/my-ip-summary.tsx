'use client';

import naturalCompare from 'natural-compare-lite';
import type { ReactNode } from 'react';
import useSWRImmutable from 'swr/immutable';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { IpLookupResponse } from '@/app/api/ip-details/route';

import { DomainLink } from './domain-link';
import { LocationMap } from './ip-details-modal';

const useDetails = (ip?: string) =>
  useSWRImmutable<IpLookupResponse>(
    ip ? `/api/ip-details?ip=${encodeURIComponent(ip)}` : null,
  );

const fields: {
  label: string;
  value: (data: IpLookupResponse) => string;
  render?: (data: IpLookupResponse) => ReactNode;
}[] = [
  { label: 'ISP', value: (data) => data.isp || 'Unknown' },
  { label: 'Organization', value: (data) => data.org || 'Unknown' },
  {
    label: 'Location',
    value: (data) =>
      [data.city, data.region, data.country].filter(Boolean).join(', ') ||
      'Unknown',
  },
  {
    label: 'Reverse DNS',
    value: (data) =>
      data.reverse.toSorted(naturalCompare).join(', ') || 'Not configured',
    render: (data) =>
      data.reverse.length
        ? data.reverse.toSorted(naturalCompare).map((domain, index) => (
            <span key={domain}>
              <DomainLink domain={domain} />
              {index < data.reverse.length - 1 && ', '}
            </span>
          ))
        : 'Not configured',
  },
  {
    label: 'Coordinates',
    value: (data) =>
      data.lat != null && data.lon != null
        ? `${data.lat}, ${data.lon}`
        : 'Unknown',
  },
  { label: 'Timezone', value: (data) => data.timezone || 'Unknown' },
];

export const MyIpSummary = ({
  ipv4,
  ipv6,
}: {
  ipv4?: string;
  ipv6?: string;
}) => {
  const details4 = useDetails(ipv4);
  const details6 = useDetails(ipv6);
  const columns = [
    { version: 4, ip: ipv4, ...details4 },
    { version: 6, ip: ipv6, ...details6 },
  ].filter((column) => column.ip);
  const locations = columns.flatMap(({ version, data }) =>
    data?.lat != null && data.lon != null
      ? [{ version, lat: data.lat, lon: data.lon }]
      : [],
  );
  const sameLocation =
    locations.length === 2 &&
    locations[0].lat === locations[1].lat &&
    locations[0].lon === locations[1].lon;
  const maps = sameLocation ? locations.slice(0, 1) : locations;

  return (
    <section
      aria-label="Network summary"
      className="min-w-0 border-t border-zinc-200 pt-4 dark:border-zinc-700"
    >
      <h3 className="mb-2 text-sm font-medium">Network summary</h3>
      {columns
        .filter((column) => column.error)
        .map((column) => (
          <div
            key={column.version}
            role="status"
            className="mb-3 flex items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400"
          >
            <span>Couldn’t load IPv{column.version} details.</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Retry IPv${column.version} details`}
              onClick={() => {
                void column.mutate().catch(() => {});
              }}
            >
              Retry
            </Button>
          </div>
        ))}
      <table className="w-full table-fixed text-left text-sm">
        <caption className="sr-only">
          {columns.length === 2
            ? 'Matching IPv4 and IPv6 values are shown once.'
            : `IPv${columns[0]?.version} network details.`}
        </caption>
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th scope="col" className="w-24 py-2 pr-3 font-medium">
              Detail
            </th>
            {columns.map(({ version }) => (
              <th key={version} scope="col" className="py-2 pl-3 font-medium">
                IPv{version}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const values = columns.map((column) =>
              column.data ? field.value(column.data) : null,
            );
            // Compare only completed responses. A missing family is never a match.
            const shared =
              columns.length === 2 &&
              columns.every((column) => column.data && !column.error) &&
              values[0] === values[1];
            return (
              <tr
                key={field.label}
                className="border-b border-zinc-200 align-top dark:border-zinc-700"
              >
                <th
                  scope="row"
                  className="py-3 pr-3 font-normal text-zinc-500 dark:text-zinc-400"
                >
                  {field.label}
                </th>
                {shared ? (
                  <td colSpan={2} className="py-3 pl-3 break-words">
                    {field.render && columns[0].data
                      ? field.render(columns[0].data)
                      : values[0]}
                    <span className="sr-only"> (same for IPv4 and IPv6)</span>
                  </td>
                ) : (
                  columns.map((column, index) => (
                    <td key={column.version} className="py-3 pl-3 break-words">
                      {column.error
                        ? 'Unavailable'
                        : ((field.render && column.data
                            ? field.render(column.data)
                            : values[index]) ?? (
                            <>
                              <Skeleton className="h-4 w-full" />
                              <span className="sr-only">
                                Loading IPv{column.version} {field.label}
                              </span>
                            </>
                          ))}
                    </td>
                  ))
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {maps.length > 0 && (
        <div className={maps.length < 2 ? '' : 'grid gap-4 sm:grid-cols-2'}>
          {maps.map(({ version, lat, lon }) => (
            <figure key={`${version}:${lat}:${lon}`} className="mt-4 min-w-0">
              <figcaption className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                {sameLocation
                  ? 'Approximate location · IPv4 and IPv6'
                  : `Approximate location · IPv${version}`}
              </figcaption>
              <div className="h-56 w-full [&_.leaflet-container]:size-full">
                <LocationMap location={[lat, lon]} />
              </div>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
};
