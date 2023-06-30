'use client';

import dynamic from 'next/dynamic';
import useSWR from 'swr';

import { Spinner } from '@/components/ui/spinner';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
});

const OverviewMap = ({ ip }) => {
  const { data, error } = useSWR(`/api/lookupIp?ip=${encodeURIComponent(ip)}`);
  let location = [0, 0];
  if (data) {
    location = [data.lat, data.lon];
  }

  return (
    <div className="h-full w-full">
      {!data ? (
        <div className="flex items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <LocationMap location={location} />
      )}
    </div>
  );
};

export default OverviewMap;
