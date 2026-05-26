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

import { getSource } from '@/lib/subfinder-sources';

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
        label: 'Found on',
        render: (value) => (
          <div className="flex flex-wrap gap-1">
            {value.map((source) => {
              const { label, url } = getSource(source);
              const className =
                'inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs whitespace-nowrap text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
              return url ? (
                <a
                  key={source}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${className} transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700`}
                >
                  {label}
                </a>
              ) : (
                <span key={source} className={className}>
                  {label}
                </span>
              );
            })}
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
