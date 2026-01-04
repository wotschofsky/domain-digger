import useSWRImmutable from 'swr/immutable';

export const useSearchSuggestions = (query: string) => {
  const { data } = useSWRImmutable<string[]>(
    query
      ? `/api/search-suggestions?q=${encodeURIComponent(query.toLowerCase())}`
      : null,
    { keepPreviousData: true },
  );
  return data ?? [];
};
