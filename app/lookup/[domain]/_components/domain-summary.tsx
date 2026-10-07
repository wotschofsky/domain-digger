'use client';

import type { FC, ReactNode } from 'react';
import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';

import { Skeleton } from '@/components/ui/skeleton';

import type { ForSaleResponse } from '@/app/api/for-sale/route';
import type { WhoisSummaryResponse } from '@/app/api/whois-summary/route';

type DomainSummaryTileProps = {
  title: string;
  children?: ReactNode;
} & (
  | { loading: true; value?: ReactNode }
  | { loading?: false; value: ReactNode }
);

const DomainSummaryTile: FC<DomainSummaryTileProps> = ({
  title,
  loading,
  value,
  children,
}) => (
  <div className="max-w-sm break-words">
    <h3 className="text-xs/6 font-medium text-zinc-500 dark:text-zinc-400">
      {title}
    </h3>
    {loading ? (
      <Skeleton className="mt-1 h-4 w-24 rounded-sm" />
    ) : (
      <p className="text-sm font-medium">{value}</p>
    )}
    {children}
  </div>
);

export const DomainSummary: FC<{ domain: string }> = ({ domain }) => {
  const { data: whois, isLoading } = useSWRImmutable<WhoisSummaryResponse>(
    `/api/whois-summary?domain=${encodeURIComponent(domain)}`,
  );
  const { data: sale } = useSWR<ForSaleResponse>(
    `/api/for-sale?domain=${encodeURIComponent(domain)}`,
    { shouldRetryOnError: false },
  );
  const listing = sale?.listing;

  return (
    <div className="flex flex-wrap gap-8">
      {isLoading || !whois ? (
        <>
          <DomainSummaryTile title="Registrar" loading />
          <DomainSummaryTile title="Creation Date" loading />
          <DomainSummaryTile title="DNSSEC" loading />
        </>
      ) : !whois.registered ? (
        <DomainSummaryTile title="Status" value="Not registered" />
      ) : (
        <>
          <DomainSummaryTile
            title="Registrar"
            value={whois.registrar || 'Unavailable'}
          />
          <DomainSummaryTile
            title="Creation Date"
            value={whois.createdAt || 'Unavailable'}
          />
          <DomainSummaryTile
            title="DNSSEC"
            value={whois.dnssec || 'Unavailable'}
          />
        </>
      )}
      {listing && (!whois || whois.registered) && (
        <DomainSummaryTile
          title={`For sale${sale.domain !== domain ? ` (${sale.domain})` : ''}`}
          value={
            <>
              {listing.prices.length
                ? listing.prices.join(' / ')
                : 'Advertised for sale'}
              {listing.prices.length > 0 && (
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  {' '}
                  (indicative)
                </span>
              )}
            </>
          }
        >
          <details className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            <summary className="cursor-pointer">Details</summary>
            <div className="mt-2 space-y-2 break-words">
              <p>{sale.domain} is advertised for sale via DNS.</p>
              {listing.prices.length > 0 && (
                <p>Price indicative only. Verify with the seller.</p>
              )}
              {listing.texts.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {listing.links.map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="block underline"
                  dir="ltr"
                >
                  {link} ↗
                </a>
              ))}
            </div>
          </details>
        </DomainSummaryTile>
      )}
    </div>
  );
};
