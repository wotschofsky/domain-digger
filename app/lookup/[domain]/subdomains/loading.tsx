import { ShareIcon } from 'lucide-react';
import type { FC } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { SubdomainsInfoAlert } from './_components/info-alert';

const SubdomainsLoading: FC = () => (
  <>
    <div className="my-12 flex items-center justify-between">
      <SubdomainsInfoAlert />
      <Button variant="outline" disabled>
        <ShareIcon className="mr-2 h-4 w-4" /> Export
      </Button>
    </div>

    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-0">Domain Name</TableHead>
          <TableHead>First seen</TableHead>
          <TableHead className="pr-0">Still exists</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map(() => (
          // eslint-disable-next-line react/jsx-key
          <TableRow className="hover:bg-transparent">
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
  </>
);

export default SubdomainsLoading;
