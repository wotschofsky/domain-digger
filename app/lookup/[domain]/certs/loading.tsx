import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const CertsLoading = () => (
  <Table>
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="pl-0">Logged At</TableHead>
        <TableHead>Not Before</TableHead>
        <TableHead>Not After</TableHead>
        <TableHead>Common Name</TableHead>
        <TableHead>Matching Identities</TableHead>
        <TableHead className="pr-0">Issuer Name</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell className="pl-0">
            <Skeleton className="h-5 w-44 rounded-sm" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-44 rounded-sm" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-44 rounded-sm" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-48 rounded-sm" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-48 rounded-sm" />
          </TableCell>
          <TableCell className="pr-0">
            <Skeleton className="h-5 w-64 rounded-sm" />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default CertsLoading;
