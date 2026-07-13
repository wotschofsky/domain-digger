'use client';

import { InfoIcon } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type InfoTooltipProps = {
  label: string;
  children: ReactNode;
};

export const InfoTooltip: FC<InfoTooltipProps> = ({ label, children }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Explain ${label}`}
          className="inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-sm text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 focus-visible:outline-none dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <InfoIcon className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 px-3 py-2 text-xs leading-relaxed font-normal tracking-normal normal-case">
        {children}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
