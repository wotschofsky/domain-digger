'use client';

import { XSquareIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const DomainNotRegistered = () => (
  <Alert variant="destructive">
    <XSquareIcon className="h-8 w-8" />
    <div className="ml-4">
      <AlertTitle>Not registered</AlertTitle>
      <AlertDescription>
        This Domain is currently not registered. If you want to register it, visit <a href='https://tlds.world' className='underline'>tlds.world</a> for the best prices.
      </AlertDescription>
    </div>
  </Alert>
);

export default DomainNotRegistered;
