'use client';

import type { FC } from 'react';
import useSWRImmutable from 'swr/immutable';

import { Skeleton } from '@/components/ui/skeleton';

import type { WhoisSummaryResponse } from '@/app/api/whois-summary/route';

type WhoisQuickInfoTileProps =
  | {
      title: string;
      loading: true;
      value?: string;
    }
  | {
      title: string;
      loading?: false;
      value: string;
    };

const WhoisQuickInfoTile: FC<WhoisQuickInfoTileProps> = ({
  title,
  loading,
  value,
}) => (
  <div>
    <h3 className="text-xs text-muted-foreground">{title}</h3>
    {loading ? (
      <Skeleton className="mt-1 h-4 w-24 rounded-sm" />
    ) : (
      <p className="text-sm">{value}</p>
    )}
  </div>
);

type WhoisQuickInfoProps = {
  domain: string;
};

export const WhoisQuickInfo: FC<WhoisQuickInfoProps> = ({ domain }) => {
  const { data, isLoading } = useSWRImmutable<WhoisSummaryResponse>(
    `/api/whois-summary?domain=${encodeURIComponent(domain)}`,
  );

  if (isLoading || !data) {
    return (
      <div className="my-8 flex flex-wrap gap-8">
        <WhoisQuickInfoTile title="Registrar" loading />
        <WhoisQuickInfoTile title="Creation Date" loading />
        <WhoisQuickInfoTile title="DNSSEC" loading />
      </div>
    );
  }

  if (!data.registered) {
    return (
      <div className="my-8 flex flex-wrap gap-8">
        <WhoisQuickInfoTile title="Status" value="Not registered" />
      </div>
    );
  }

  return (
    <div className="my-8 flex flex-wrap gap-8">
      <WhoisQuickInfoTile
        title="Registrar"
        value={data?.registrar || 'Unavailable'}
      />
      <WhoisQuickInfoTile
        title="Creation Date"
        value={data?.createdAt || 'Unavailable'}
      />
      <WhoisQuickInfoTile
        title="DNSSEC"
        value={data?.dnssec || 'Unavailable'}
      />
    </div>
  );
};
