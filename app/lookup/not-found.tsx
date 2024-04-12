import type { FC } from 'react';

import { SearchForm } from '../_components/search-form';

const LookupNotFound: FC = () => (
  <div className="container mt-12 flex flex-col items-center gap-2">
    <h2 className="text-xl font-bold">Not a valid domain</h2>

    <div className="mt-16 w-full max-w-2xl">
      <SearchForm autofocus />
    </div>
  </div>
);

export default LookupNotFound;
