import useSWRImmutable from 'swr/immutable';

import { normalizeDomain } from '@/lib/search-parser';

export const useSearchSuggestions = (query: string) => {
  const normalizedQuery = normalizeDomain(query);

  const { data } = useSWRImmutable<string[]>(
    normalizedQuery
      ? `/api/search-suggestions?q=${encodeURIComponent(normalizedQuery)}`
      : null,
    { keepPreviousData: true },
  );

  return data ?? [];
};
