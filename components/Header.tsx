import Link from 'next/link';

import LogoDark from '@/assets/logo-dark.svg';
import LogoLight from '@/assets/logo-light.svg';
import BookmarkletLink from '@/components/BookmarkletLink';
import ThemeMenu from '@/components/ThemeMenu';

const Header = () => (
  <header className="w-full p-4 md:px-8">
    <div className="flex items-center justify-between pb-4">
      <Link className="flex items-center gap-2" href="/">
        <LogoDark className="inline h-6 dark:hidden" />
        <LogoLight className="hidden h-6 dark:inline" />
        Domain Digger
      </Link>

      <div className="flex items-center justify-between gap-4">
        <BookmarkletLink />
        <ThemeMenu />
      </div>
    </div>
  </header>
);

export default Header;
