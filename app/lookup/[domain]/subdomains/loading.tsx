import type { FC } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SubdomainsLoading: FC = () => (
  <Table>
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="pl-0">Domain Name</TableHead>
        <TableHead>First seen</TableHead>
        <TableHead className="pr-0">Still exists</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell className="pl-0">
            <Skeleton className="h-5 w-64 rounded-sm" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-80 rounded-sm" />
          </TableCell>
          <TableCell className="pr-0">
            <Skeleton className="h-5 w-5 rounded-sm" />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default SubdomainsLoading;
