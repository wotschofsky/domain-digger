'use client';

import { CheckIcon, ClipboardIcon } from 'lucide-react';
import { usePlausible } from 'next-plausible';
import { type FC, useCallback, useState } from 'react';
import { toast } from 'sonner';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type CopyButton = {
  value: string;
};

export const CopyButton: FC<CopyButton> = ({ value }) => {
  const plausible = usePlausible();

  const [wasCopied, setWasCopied] = useState(false);
  const copy = useCallback(() => {
    setWasCopied(true);
    navigator.clipboard.writeText(value);
    setTimeout(() => setWasCopied(false), 2000);

    toast('Copied to clipboard');

    plausible('Copy Button: Click', { props: { value } });
  }, [value, setWasCopied, plausible]);

  if (wasCopied) {
    return <CheckIcon className="mx-1 inline-block h-4 w-4 -translate-y-0.5" />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <ClipboardIcon
            role="button"
            className="mx-1 inline-block h-4 w-4 -translate-y-0.5 cursor-pointer"
            onClick={copy}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Copy Value</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
