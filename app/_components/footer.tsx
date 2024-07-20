import type { FC, HTMLAttributes } from 'react';
import { FaGithub, FaHeart } from 'react-icons/fa';

import { Button } from '@/components/ui/button';

import PoweredByVercel from '@/assets/powered-by-vercel.svg';
import { cn } from '@/lib/utils';

type VercelBadgeProps = HTMLAttributes<HTMLAnchorElement>;

const VercelBadge: FC<VercelBadgeProps> = ({ className, ...props }) => (
  <a
    className={cn('[&>svg]:h-10', className)}
    href="https://vercel.com/?utm_source=domain-digger&utm_campaign=oss"
    target="_blank"
    rel="noopener"
    {...props}
  >
    <PoweredByVercel />
    <span className="sr-only">Powered by Vercel</span>
  </a>
);

export const Footer: FC = () => (
  <footer className="w-full p-4 md:px-8">
    <div className="flex flex-col items-center gap-4 border-t pt-4">
      <VercelBadge className="md:hidden" />

      <div className="flex w-full items-center justify-between">
        <p className="text-sm">
          Created with{' '}
          <FaHeart className="inline text-red-500" fontSize="1.25rem" />
          <span className="sr-only">love</span> by{' '}
          <a
            className="underline decoration-dotted underline-offset-4"
            href="https://wotschofsky.com"
            target="_blank"
            rel="noopener"
            aria-label="Felix Wotschofsky (Site Creator)"
          >
            Felix Wotschofsky
          </a>
        </p>

        <VercelBadge className="hidden md:block" />

        <Button variant="ghost" asChild>
          <a
            href="https://github.com/wotschofsky/domain-digger"
            target="_blank"
            rel="noopener"
          >
            <FaGithub className="h-6 w-6" />
            <span className="sr-only">GitHub Repository</span>
          </a>
        </Button>
      </div>
    </div>
  </footer>
);
