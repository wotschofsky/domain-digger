'use client';

import { InfoIcon } from 'lucide-react';
import { type FC, useCallback, useState } from 'react';

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
  const open = useCallback(() => {
    setOpen(true);
    reportEvent('IP Details: Open', { ip: value });
  }, [setOpen, reportEvent, value]);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild onClick={open}>
            <a
              className="cursor-pointer underline decoration-dotted underline-offset-4"
              aria-label={`Details for IP ${value}`}
              tabIndex={0}
            >
              <span className="select-all">{value}</span>
              <InfoIcon
                role="button"
                className="mx-1 inline-block size-3 -translate-y-0.5"
              />
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <p>View IP Info</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <IpDetailsModal ip={value} open={isOpen} onOpenChange={setOpen} />
    </>
  );
};
