import useSWRImmutable from 'swr/immutable';

export const useSearchSuggestions = (query: string) => {
  const { data } = useSWRImmutable<string[]>(
    `/api/search-suggestions?q=${encodeURIComponent(query.toLowerCase())}`,
    { keepPreviousData: true },
  );
  return data;
};
