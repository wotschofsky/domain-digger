import useSWRImmutable from 'swr/immutable';

type StargazersSummaryResponse = {
  recentStargazers: Array<{
    name: string;
    avatarUrl: string;
  }>;
  totalStars: number;
};

export const useStargazersSummary = () =>
  useSWRImmutable<StargazersSummaryResponse>('/api/stargazers-summary');
