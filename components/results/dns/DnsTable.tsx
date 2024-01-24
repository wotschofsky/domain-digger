import naturalCompare from 'natural-compare-lite';
import { type FC, Fragment } from 'react';

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import RecordRow from '@/components/results/dns/RecordRow';
import type { ResolvedRecords } from '@/lib/resolvers/DnsResolver';

type DnsTableProps = {
  records: ResolvedRecords;
  ipsInfo: Record<string, string>;
};

const DnsTable: FC<DnsTableProps> = ({ records, ipsInfo }) => (
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

          <div className="overflow-x-auto">
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
                  .sort((a, b) => naturalCompare(a.data, b.data))
                  .map((v) => (
                    <RecordRow
                      key={v.type + v.data}
                      name={v.name}
                      TTL={v.TTL}
                      value={v.data}
                      subvalue={ipsInfo[v.data]}
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

export default DnsTable;
