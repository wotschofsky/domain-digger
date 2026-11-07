'use client';

import { CheckIcon, ClipboardIcon } from 'lucide-react';
import { type FC, useState } from 'react';
import { toast } from 'sonner';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useAnalytics } from '@/lib/analytics';

type CopyButton = {
  value: string;
};

export const CopyButton: FC<CopyButton> = ({ value }) => {
  const { reportEvent } = useAnalytics();

  const [wasCopied, setWasCopied] = useState(false);
  const copy = () => {
    setWasCopied(true);
    navigator.clipboard.writeText(value);
    setTimeout(() => setWasCopied(false), 2000);

    toast('Copied to clipboard');

    reportEvent('Copy Button: Click', { value });
  };

  if (wasCopied) {
    return <CheckIcon className="mx-1 inline-block size-4 -translate-y-0.5" />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Copy value"
            onClick={copy}
            className="mx-1 inline-flex -translate-y-0.5 cursor-pointer rounded-sm align-middle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <ClipboardIcon className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copy Value</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
