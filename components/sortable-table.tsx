'use client';

import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { cn } from '@/lib/utils';

type Column<T> = {
  [K in keyof T]: {
    key: K;
    label: string;
    render?: (value: T[K], row: T) => React.ReactNode;
  };
}[keyof T];

type SortDirection = 'asc' | 'desc';

type SortableTableProps<T extends Record<string, any>> = {
  data: T[];
  columns: Column<T>[];
  keyColumn: keyof T;
  defaultSort: keyof T;
  defaultSortDirection: SortDirection;
};

export const SortableTable = <T extends Record<string, any>>({
  data,
  columns,
  keyColumn,
  defaultSort,
  defaultSortDirection,
}: SortableTableProps<T>) => {
  const [sort, setSort] = useState<keyof T>(defaultSort);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(defaultSortDirection);

  const sortedData = useMemo(
    () =>
      data.sort((a, b) => {
        if (a[sort] > b[sort]) return sortDirection === 'asc' ? 1 : -1;
        if (a[sort] < b[sort]) return sortDirection === 'asc' ? -1 : 1;
        return 0;
      }),
    [data, sort, sortDirection],
  );

  const handleSort = useCallback(
    (key: keyof T) => {
      if (sort === key) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSort(key);
        setSortDirection('asc');
      }
    },
    [sort, sortDirection],
  );

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map(({ key, label }, index, allColumns) => (
            <TableHead
              key={key.toString()}
              className={cn(
                'cursor-pointer select-none',
                {
                  'pl-0': index === 0,
                  'pr-0': index === allColumns.length - 1,
                },
                {
                  // Compensate for sort icon not being present
                  'pr-10': sort !== key && index !== allColumns.length - 1,
                  'pr-6': sort !== key && index === allColumns.length - 1,
                },
              )}
              onClick={() => handleSort(key)}
            >
              {label}
              {sort === key &&
                (sortDirection === 'asc' ? (
                  <ArrowDownIcon className="inline-block h-4" />
                ) : (
                  <ArrowUpIcon className="inline-block h-4" />
                ))}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedData.map((row) => (
          <TableRow key={row[keyColumn]} className="hover:bg-transparent">
            {columns.map(({ key, render }, index, allColumns) => (
              <TableCell
                key={key.toString()}
                className={cn({
                  'pl-0': index === 0,
                  'pr-0': index === allColumns.length - 1,
                })}
              >
                {render ? render(row[key], row) : row[key].toString()}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
