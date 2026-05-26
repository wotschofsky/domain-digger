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

import { DomainLink } from '../../../../_components/domain-link';

type SubdomainsTableProps = {
  results: {
    domain: string;
    sources: string[];
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
        key: 'sources',
        label: 'Sources',
        render: (value) => (
          <div className="flex flex-wrap gap-1">
            {value.map((source) => (
              <span
                key={source}
                className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {source}
              </span>
            ))}
          </div>
        ),
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
    defaultSort="domain"
    defaultSortDirection="asc"
  />
);
