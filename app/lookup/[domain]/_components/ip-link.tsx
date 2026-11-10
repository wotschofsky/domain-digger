'use client';

import { InfoIcon } from 'lucide-react';
import { type FC, useState } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useAnalytics } from '@/lib/analytics';

import { IpDetailsModal } from '../../../_components/ip-details-modal';

type IpLinkProps = {
  value: string;
};

export const IpLink: FC<IpLinkProps> = ({ value }) => {
  const { reportEvent } = useAnalytics();

  const [isOpen, setOpen] = useState(false);
  const open = () => {
    setOpen(true);
    reportEvent('IP Details: Open', { ip: value });
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild onClick={open}>
            <button
              type="button"
              className="inline cursor-pointer text-left underline decoration-dotted underline-offset-4"
              aria-label={`Details for IP ${value}`}
            >
              <span className="select-all">{value}</span>
              <InfoIcon className="mx-1 inline-block size-3 -translate-y-0.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View IP Info</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isOpen && <IpDetailsModal ip={value} open onOpenChange={setOpen} />}
    </>
  );
};
