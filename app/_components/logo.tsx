import Link from 'next/link';
import type { FC } from 'react';

import LogoDark from '@/assets/logo-dark.svg';
import LogoLight from '@/assets/logo-light.svg';
import { cn } from '@/lib/utils';

type LogoProps = {
  textClassName?: string;
};

export const Logo: FC<LogoProps> = ({ textClassName }) => (
  <Link className="flex items-center gap-2" href="/" aria-label="Home Page">
    <LogoDark className="inline h-6 flex-shrink-0 dark:hidden" />
    <LogoLight className="hidden h-6 flex-shrink-0 dark:inline" />
    <span className={cn('whitespace-nowrap', textClassName)}>
      Domain Digger
    </span>
  </Link>
);
