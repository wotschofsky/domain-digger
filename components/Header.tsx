import Link from 'next/link';

import ThemeMenu from '@/components/ThemeMenu';

const Header = () => (
  <header className="w-full p-4 md:px-8">
    <div className="flex flex-col items-center justify-between pb-4 sm:flex-row">
      <Link href="/">Domain Digga</Link>
      <ThemeMenu />
    </div>
  </header>
);

export default Header;
