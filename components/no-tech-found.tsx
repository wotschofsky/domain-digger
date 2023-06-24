'use client';

import { XSquareIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const NoTechFound = () => (
  <Alert variant="destructive">
    <XSquareIcon className="h-8 w-8" />
    <div className="ml-4">
      <AlertTitle>No technologies found</AlertTitle>
      <AlertDescription>
        We did not find any technologies for this domain.
      </AlertDescription>
    </div>
  </Alert>
);

export default NoTechFound;
