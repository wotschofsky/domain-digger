'use client';

import { CheckIcon, ClipboardIcon } from 'lucide-react';
import { type FC, useEffect, useRef, useState } from 'react';
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

  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  const wasCopied = copiedValue === value;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      toast.error('Could not copy to clipboard');
      return;
    }
    setCopiedValue(value);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setCopiedValue(null), 2000);
    toast('Copied to clipboard');
    reportEvent('Copy Button: Click', { value });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={wasCopied ? 'Copied' : 'Copy value'}
            onClick={copy}
            className="mx-1 inline-flex -translate-y-0.5 cursor-pointer rounded-sm align-middle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {wasCopied ? (
              <CheckIcon className="size-4" />
            ) : (
              <ClipboardIcon className="size-4" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{wasCopied ? 'Copied' : 'Copy Value'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
