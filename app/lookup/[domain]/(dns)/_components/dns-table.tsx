import naturalCompare from 'natural-compare-lite';
import { type FC, Fragment } from 'react';

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { RecordContextEntry } from '@/lib/record-context';
import type { ResolvedRecords } from '@/lib/resolvers/base';

import { RecordRow } from './record-row';
import { StackedRecord } from './stacked-record';

type DnsTableProps = {
  records: ResolvedRecords;
  subvalues: Record<string, RecordContextEntry[]>;
};

export const DnsTable: FC<DnsTableProps> = ({ records, subvalues }) => (
  <>
    {Object.keys(records).map((recordType) => {
      const value = records[recordType];

      if (!value || value.length === 0) {
        return;
      }

      return (
        <Fragment key={recordType}>
          <h2 className="mb-4 mt-8 text-xl font-semibold tracking-tight sm:text-2xl">
            {recordType}
          </h2>

          <div className="flex flex-col gap-4 sm:hidden">
            {value
              .slice()
              .toSorted((a, b) => naturalCompare(a.data, b.data))
              .map((v, i) => (
                <Fragment key={v.type + v.data}>
                  {i > 0 && <hr />}
                  <StackedRecord
                    name={v.name}
                    TTL={v.TTL}
                    value={v.data}
                    subvalues={subvalues[v.data]}
                  />
                </Fragment>
              ))}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <Table key={recordType}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-0">Name</TableHead>
                  <TableHead>TTL</TableHead>
                  <TableHead className="pr-0">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {value
                  .slice()
                  .toSorted((a, b) => naturalCompare(a.data, b.data))
                  .map((v) => (
                    <RecordRow
                      key={v.type + v.data}
                      name={v.name}
                      TTL={v.TTL}
                      value={v.data}
                      subvalues={subvalues[v.data]}
                    />
                  ))}
              </TableBody>
            </Table>
          </div>
        </Fragment>
      );
    })}
  </>
);
