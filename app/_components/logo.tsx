import Link from 'next/link';
import type { FC } from 'react';

import LogoDark from '@/assets/logo-dark.svg';
import LogoLight from '@/assets/logo-light.svg';

export const Logo: FC = () => (
  <Link className="flex items-center gap-2" href="/" aria-label="Home Page">
    <LogoDark className="inline h-6 dark:hidden" />
    <LogoLight className="hidden h-6 dark:inline" />
    Domain Digger
  </Link>
);
