'use client';

import type { FC } from 'react';
import useSWRImmutable from 'swr/immutable';

import { WhoisSummaryResponse } from '@/app/api/whois-summary/route';

import { Skeleton } from '../ui/skeleton';

type WhoisQuickInfoProps = {
  domain: string;
};

const WhoisQuickInfo: FC<WhoisQuickInfoProps> = ({ domain }) => {
  const { data, isLoading } = useSWRImmutable<WhoisSummaryResponse>(
    `/api/whois-summary?domain=${encodeURIComponent(domain)}`
  );

  return (
    <div className="my-8 flex gap-8">
      <div>
        <h3 className="text-xs text-muted-foreground">Registrar</h3>
        {isLoading ? (
          <Skeleton className="mt-1 h-4 w-24 rounded-sm" />
        ) : (
          <p className="text-sm">{data?.registrar || 'Unavailable'}</p>
        )}
      </div>
      <div>
        <h3 className="text-xs text-muted-foreground">Creation Date</h3>
        {isLoading ? (
          <Skeleton className="w-18 mt-1 h-4 rounded-sm" />
        ) : (
          <p className="text-sm">{data?.createdAt || 'Unavailable'}</p>
        )}
      </div>
      <div>
        <h3 className="text-xs text-muted-foreground">DNSSEC</h3>
        {isLoading ? (
          <Skeleton className="mt-1 h-4 w-16 rounded-sm" />
        ) : (
          <p className="text-sm">{data?.dnssec || 'Unavailable'}</p>
        )}
      </div>
    </div>
  );
};

export default WhoisQuickInfo;
