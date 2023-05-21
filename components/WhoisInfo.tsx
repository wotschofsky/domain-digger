'use client';

import { type FC, Fragment } from 'react';
import useSWR from 'swr';

import { Spinner } from '@/components/ui/spinner';

import type { WhoisLookupResponse } from '@/app/api/lookupWhois/route';

type IpDetailsModalProps = {
  domain: string;
};

const WhoisModal: FC<IpDetailsModalProps> = ({ domain }) => {
  const { data, error } = useSWR<WhoisLookupResponse>(
    `/api/lookupWhois?domain=${encodeURIComponent(domain)}`
  );

  if (!data) {
    return (
      <div className="items-cen flex justify-center">
        <Spinner className="my-8" />
      </div>
    );
  }

  if (error) {
    return <p>An error occurred!</p>;
  }

  return (
    <>
      {Object.keys(data).map((key) => (
        <Fragment key={key}>
          <h2 className="mb-4 mt-8 text-3xl font-bold tracking-tight">{key}</h2>
          <code className="whitespace-pre-wrap">{data[key]}</code>
        </Fragment>
      ))}
    </>
  );
};

export default WhoisModal;
