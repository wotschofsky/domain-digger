import { HeartIcon } from 'lucide-react';
import type { FC } from 'react';
import { FaGithub } from 'react-icons/fa';

import { Button } from '@/components/ui/button';

import { BookmarkletLink } from './bookmarklet-link';
import { Logo } from './logo';
import { SearchForm } from './search-form';
import { ThemeMenu } from './theme-menu';

type HeaderProps = {
  showSearch: boolean;
};

export const Header: FC<HeaderProps> = ({ showSearch }) => (
  <header className="w-full p-4 md:px-8">
    <div className="flex items-center justify-between gap-4 md:gap-6">
      <div className="flex items-center justify-start gap-8">
        <Logo textClassName="hidden sm:inline" />
        <div className="hidden lg:block">
          <BookmarkletLink />
        </div>
      </div>

      {showSearch && (
        <div className="w-full max-w-lg">
          <SearchForm autofocus={false} />
        </div>
      )}

      <div className="flex items-center justify-end md:gap-2">
        <Button variant="ghost" asChild className="px-2">
          <a
            href="https://github.com/sponsors/wotschofsky"
            target="_blank"
            rel="noopener"
          >
            <HeartIcon className="mr-1 h-6 w-4 text-pink-600" />
            <span className="sr-only md:not-sr-only">Sponsor</span>
          </a>
        </Button>
        <Button variant="ghost" asChild className="px-2">
          <a
            href="https://github.com/wotschofsky/domain-digger"
            target="_blank"
            rel="noopener"
          >
            <FaGithub className="mr-1 h-6 w-4" />
            <span className="hidden md:inline">
              Star <span className="sr-only">on GitHub</span>
            </span>
          </a>
        </Button>
        <ThemeMenu />
      </div>
    </div>
  </header>
);
