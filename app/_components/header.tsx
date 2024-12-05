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
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center justify-start gap-8">
        <Logo />
        <div className="hidden md:block">
          <BookmarkletLink />
        </div>
      </div>

      {showSearch && (
        <div className="max-w-xl flex-1">
          <SearchForm autofocus={false} />
        </div>
      )}

      <div className="flex flex-1 items-center justify-end gap-4">
        <Button variant="ghost" asChild>
          <a
            href="https://github.com/sponsors/wotschofsky"
            target="_blank"
            rel="noopener"
          >
            <HeartIcon className="mr-1 h-6 w-4 text-pink-600" />
            <span>Sponsor</span>
          </a>
        </Button>
        <Button variant="ghost" asChild>
          <a
            href="https://github.com/wotschofsky/domain-digger"
            target="_blank"
            rel="noopener"
          >
            <FaGithub className="mr-1 h-6 w-4" />
            <span>Star</span>
            <span className="sr-only">on GitHub</span>
          </a>
        </Button>
        <ThemeMenu />
      </div>
    </div>
  </header>
);
