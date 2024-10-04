'use client';

import { CheckIcon, FileQuestionIcon, XIcon } from 'lucide-react';
import type { FC } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { SortableTable } from '@/components/sortable-table';

import { DomainLink } from '../../_components/domain-link';

type SubdomainsTableProps = {
  results: {
    domain: string;
    firstSeen: Date;
    stillExists: boolean | null;
  }[];
  detailedResultsLimit: number;
};

export const SubdomainsTable: FC<SubdomainsTableProps> = ({
  results,
  detailedResultsLimit,
}) => (
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
          value === null ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <FileQuestionIcon size="1.25rem" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Detailed results limited to {detailedResultsLimit}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : value ? (
            <CheckIcon size="1.25rem" />
          ) : (
            <XIcon size="1.25rem" />
          ),
      },
    ]}
    keyColumn="domain"
    defaultSort="firstSeen"
    defaultSortDirection="desc"
  />
);
