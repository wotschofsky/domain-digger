'use client';

import { ExternalLinkIcon } from 'lucide-react';
import type { FC, ReactNode } from 'react';
import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

import type { ForSaleResponse } from '@/app/api/for-sale/route';
import type { WhoisSummaryResponse } from '@/app/api/whois-summary/route';
import { formatSalePrice } from '@/lib/format-sale-price';

type DomainSummaryTileProps = {
  title: string;
} & (
  | { loading: true; value?: ReactNode }
  | { loading?: false; value: ReactNode }
);

const DomainSummaryTile: FC<DomainSummaryTileProps> = ({
  title,
  loading,
  value,
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
  </div>
);

type SaleListingLinkProps = {
  href?: string;
  children: ReactNode;
};

const SaleListingLink: FC<SaleListingLinkProps> = ({ href, children }) => {
  if (!href) return children;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
          aria-label="View sale listing on an external website"
        >
          <span>{children}</span>
          <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden="true" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Open external website?</AlertDialogTitle>
          <AlertDialogDescription>
            This is an external website that Domain Digger does not control.
            Verify the listing and price with the seller.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm break-all" dir="ltr">
          {href}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              Continue
              <ExternalLinkIcon className="ml-2 size-4" aria-hidden="true" />
            </a>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const DomainSummary: FC<{ domain: string }> = ({ domain }) => {
  const { data: whois, isLoading } = useSWRImmutable<WhoisSummaryResponse>(
    `/api/whois-summary?domain=${encodeURIComponent(domain)}`,
  );
  const { data: sale } = useSWR<ForSaleResponse>(
    `/api/for-sale?domain=${encodeURIComponent(domain)}`,
    { shouldRetryOnError: false },
  );
  const listing = sale?.listing;
  const saleUrl = listing?.links.find((link) => /^https?:\/\//i.test(link));

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
            <SaleListingLink href={saleUrl}>
              {listing.prices.length
                ? listing.prices.map(formatSalePrice).join(' / ')
                : 'Advertised for sale'}
            </SaleListingLink>
          }
        />
      )}
    </div>
  );
};
