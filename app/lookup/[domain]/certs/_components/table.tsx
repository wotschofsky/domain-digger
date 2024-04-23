'use client';

import type { FC } from 'react';

import { SortableTable } from '@/components/sortable-table';
import type { CertsData } from '@/lib/certs';
import { isValidDomain } from '@/lib/utils';

import { DomainLink } from '../../_components/domain-link';

type CertsTableProps = {
  certs: CertsData;
};

export const CertsTable: FC<CertsTableProps> = ({ certs }) => (
  <SortableTable
    data={certs}
    columns={[
      {
        key: 'entry_timestamp',
        label: 'Logged At',
      },
      {
        key: 'not_before',
        label: 'Not Before',
      },
      {
        key: 'not_after',
        label: 'Not After',
      },
      {
        key: 'common_name',
        label: 'Common Name',
        render: (value: string) =>
          isValidDomain(value) ? (
            <DomainLink domain={value} />
          ) : (
            <span>{value}</span>
          ),
      },
      {
        key: 'name_value',
        label: 'Matching Identities',
        render: (value) =>
          value.split(/\n/g).map((value, index) => (
            <>
              {index !== 0 && <br />}
              {isValidDomain(value) ? (
                <DomainLink domain={value} />
              ) : (
                <span>{value}</span>
              )}
            </>
          )),
      },
      {
        key: 'issuer_name',
        label: 'Issuer Name',
      },
    ]}
    keyColumn="id"
    defaultSort="entry_timestamp"
    defaultSortDirection="desc"
  />
);
