'use client';

import {
  ExternalLinkIcon,
  MailIcon,
  RotateCwIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';
import useSWR from 'swr';

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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { DomainSummaryResponse } from '@/app/api/domain-summary/route';
import { formatSalePrice } from '@/lib/format-sale-price';
import { canonicalDnsName } from '@/lib/resolvers/base';

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

  const className =
    'inline-flex cursor-pointer items-center gap-1 text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-4';

  if (href.startsWith('mailto:')) {
    return (
      <a href={href} className={className}>
        <span>{children}</span>
        <span className="sr-only"> — Contact seller by email</span>
        <MailIcon className="size-3.5 shrink-0" aria-hidden="true" />
      </a>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" className={className}>
          <span>{children}</span>
          <span className="sr-only">
            {' '}
            — View sale listing on an external website
          </span>
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
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<DomainSummaryResponse>(
      `/api/domain-summary?domain=${encodeURIComponent(domain)}`,
    );

  if (error && !data) {
    return (
      <div
        role="alert"
        className="flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-zinc-950/10 bg-zinc-50 py-3 pr-3 pl-4 shadow-xs dark:border-white/10 dark:bg-white/5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
            <TriangleAlertIcon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Domain summary unavailable
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Registration details couldn&rsquo;t be loaded.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 bg-white dark:bg-zinc-900"
          disabled={isValidating}
          aria-busy={isValidating}
          onClick={() => void mutate().catch(() => undefined)}
        >
          <RotateCwIcon
            className={`size-4 shrink-0 ${isValidating ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isValidating ? 'Retrying…' : 'Retry'}
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-wrap gap-8">
        <DomainSummaryTile title="Registrar" loading />
        <DomainSummaryTile title="Creation Date" loading />
        <DomainSummaryTile title="DNSSEC" loading />
      </div>
    );
  }

  if (!data.whois.registered) {
    return (
      <div className="flex flex-wrap gap-8">
        <DomainSummaryTile title="Status" value="Not registered" />
      </div>
    );
  }

  const { whois } = data;
  // No sale tile when the WHOIS lookup failed and registration is only assumed.
  const sale = whois.unknown ? null : data.sale;
  const listing = sale?.listing;
  const saleUrl =
    listing?.links.find((link) => /^https?:\/\//i.test(link)) ??
    listing?.links.find((link) => link.startsWith('mailto:'));

  return (
    <div className="flex flex-wrap gap-8">
      <DomainSummaryTile
        title="Registrar"
        value={whois.registrar || 'Unavailable'}
      />
      <DomainSummaryTile
        title="Creation Date"
        value={whois.createdAt || 'Unavailable'}
      />
      <DomainSummaryTile title="DNSSEC" value={whois.dnssec || 'Unavailable'} />
      {sale && listing && (
        <DomainSummaryTile
          // Advertised prices are not binding and are labelled as such, as
          // RFC 10023 (§4) asks of anyone displaying them.
          title={`For sale${sale.domain !== canonicalDnsName(domain) ? ` (${sale.domain})` : ''}${listing.prices.length ? ' · indicative price' : ''}`}
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
