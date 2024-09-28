import naturalCompare from 'natural-compare-lite';
import { type FC, Fragment } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { RecordContextEntry } from '@/lib/record-context';
import type { ResolverMultiResponse } from '@/lib/resolvers/base';
import { cn } from '@/lib/utils';

import { RecordRow } from './record-row';
import { StackedRecord } from './stacked-record';

type DnsTableProps = {
  records: ResolverMultiResponse;
  subvalues: Record<string, RecordContextEntry[]>;
};

export const DnsTable: FC<DnsTableProps> = ({ records, subvalues }) => (
  <>
    {Object.entries(records).map(([recordType, response]) => {
      if (!response || response.records.length === 0) {
        return null;
      }

      const sortedRecords = response.records.toSorted((a, b) =>
        naturalCompare(a.data, b.data),
      );

      return (
        <Fragment key={recordType}>
          <Collapsible>
            <div className="mb-2 mt-14 flex items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {recordType}
              </h2>
              <CollapsibleTrigger
                className={cn(
                  'text-sm text-muted-foreground underline decoration-dotted underline-offset-4',
                  'plausible-event-name=Trace:+Click',
                  `plausible-event-domain=${sortedRecords[0].name}`,
                  `plausible-event-type=${recordType}`,
                )}
              >
                View Trace
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
              <code className="block overflow-x-scroll whitespace-nowrap rounded border border-slate-300 bg-slate-200 p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800">
                {response.trace.map((line) => (
                  // eslint-disable-next-line react/jsx-key
                  <Fragment>
                    {line}
                    <br />
                  </Fragment>
                ))}
              </code>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex flex-col gap-4 sm:hidden">
            {sortedRecords.map((v, i) => (
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
                  <TableHead className="w-32">TTL</TableHead>
                  <TableHead className="pr-0">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.map((v) => (
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
