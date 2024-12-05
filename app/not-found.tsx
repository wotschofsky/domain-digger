import type { FC } from 'react';

import { Logo } from './_components/logo';
import { SearchForm } from './_components/search-form';

const GlobalNotFound: FC = () => (
  <div className="container mt-12 flex flex-col items-center">
    <h2 className="text-xl font-bold">Page not found</h2>

    <div className="mb-24 mt-12 w-full max-w-2xl">
      <SearchForm autofocus />
    </div>

    <Logo />
  </div>
);

export default GlobalNotFound;
