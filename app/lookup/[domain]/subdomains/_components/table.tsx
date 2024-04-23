'use client';

import { CheckIcon, XIcon } from 'lucide-react';
import type { FC } from 'react';

import { SortableTable } from '@/components/sortable-table';

import { DomainLink } from '../../_components/domain-link';

type SubdomainsTableProps = {
  results: {
    domain: string;
    firstSeen: Date;
    stillExists: boolean;
  }[];
};

export const SubdomainsTable: FC<SubdomainsTableProps> = ({ results }) => (
  <SortableTable
    data={results}
    columns={[
      {
        key: 'domain',
        label: 'Domain Name',
        render: (value) => <DomainLink domain={value} />,
      },
      {
        key: 'firstSeen',
        label: 'First seen',
        render: (value) => value.toISOString(),
      },
      {
        key: 'stillExists',
        label: 'Still exists',
        render: (value) =>
          value ? <CheckIcon size="1.25rem" /> : <XIcon size="1.25rem" />,
      },
    ]}
    keyColumn="domain"
    defaultSort="firstSeen"
    defaultSortDirection="desc"
  />
);
