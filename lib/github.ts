import { log } from 'evlog';

import { env } from '@/env';

type StargazerSummary = {
  recentStargazers: Array<{
    name: string;
    avatarUrl: string;
  }>;
  totalStars: number;
};

export const getStargazersSummary = async (
  owner: string,
  repo: string,
  limit = 5,
): Promise<StargazerSummary> => {
  if (!env.GITHUB_TOKEN) {
    log.warn({ message: 'github_token_missing', context: 'stargazers' });
    return {
      recentStargazers: Array.from({ length: limit }).map(() => ({
        name: 'GitHub User',
        avatarUrl: 'https://avatars.githubusercontent.com/u/33993147?v=4',
      })),
      totalStars: 0,
    };
  }

  // Use GraphQL to get the most recent stargazers and total count
  const graphqlResponse = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      query: `
        query StargazersSummary($owner: String!, $repo: String!, $limit: Int!) {
          repository(owner: $owner, name: $repo) {
            stargazerCount
            stargazers(first: $limit, orderBy: {field: STARRED_AT, direction: DESC}) {
              nodes {
                login
                name
                avatarUrl
              }
            }
          }
        }
      `,
      variables: {
        owner,
        repo,
        limit,
      },
    }),
  });

  if (!graphqlResponse.ok) {
    const body = await graphqlResponse.text();
    throw new Error(
      `Failed to fetch GitHub stargazers: ${graphqlResponse.status} ${graphqlResponse.statusText}\n${body}`,
    );
  }

  const result = await graphqlResponse.json();

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return {
    recentStargazers: result.data.repository.stargazers.nodes.map(
      (user: any) => ({
        name: user.name || user.login,
        avatarUrl: user.avatarUrl,
      }),
    ),
    totalStars: result.data.repository.stargazerCount,
  };
};
