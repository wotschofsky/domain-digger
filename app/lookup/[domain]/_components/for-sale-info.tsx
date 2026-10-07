'use client';

import type { FC } from 'react';
import useSWR from 'swr';

import type { ForSaleResponse } from '@/app/api/for-sale/route';

export const ForSaleInfo: FC<{ domain: string }> = ({ domain }) => {
  const { data } = useSWR<ForSaleResponse>(
    `/api/for-sale?domain=${encodeURIComponent(domain)}`,
    { shouldRetryOnError: false },
  );
  if (!data?.listing) return null;
  const { listing } = data;
  return (
    <div className="max-w-sm break-words">
      <h3 className="text-xs/6 font-medium text-zinc-500 dark:text-zinc-400">
        For sale
        {data.domain !== domain && ` (${data.domain})`}
      </h3>
      <p className="text-sm font-medium">
        {listing.prices.length
          ? listing.prices.join(' / ')
          : 'Advertised for sale'}
        {listing.prices.length > 0 && (
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            {' '}
            (indicative)
          </span>
        )}
      </p>
      <details className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        <summary className="cursor-pointer">Details</summary>
        <div className="mt-2 space-y-2 break-words">
          <p>{data.domain} is advertised for sale via DNS.</p>
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
    </div>
  );
};
