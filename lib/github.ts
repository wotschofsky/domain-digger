import { env } from '@/env';

type SponsorsQueryResponse = {
  data: {
    user: {
      sponsorshipsAsMaintainer: {
        nodes: {
          sponsorEntity: {
            login: string;
            name: string;
            url: string;
            avatarUrl: string;
            websiteUrl: string | null;
          };
          tier: {
            id: string;
          } | null;
        }[];
      };
    };
  };
};

export const getGitHubSponsors = async (username: string) => {
  if (!env.GITHUB_TOKEN) {
    console.warn('GITHUB_TOKEN not set; skipping GitHub sponsors');
    return [];
  }

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      query: `
        query SponsorsQuery($username: String!) {
          user(login: $username) {
            sponsorshipsAsMaintainer(first: 100) {
              nodes {
                sponsorEntity {
                  ... on User {
                    login
                    name
                    url
                    avatarUrl
                    websiteUrl
                  }
                  ... on Organization {
                    login
                    name
                    url
                    avatarUrl
                    websiteUrl
                  }
                }
                tier {
                  id
                }
              }
            }
          }
        }
      `,
      variables: {
        username,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to fetch GitHub sponsors: ${response.status} ${response.statusText}\n${body}`,
    );
  }

  const body = (await response.json()) as SponsorsQueryResponse;

  const sponsors = body.data.user.sponsorshipsAsMaintainer.nodes.map((node) => {
    if (!node.tier) {
      throw new Error(
        'Failed to fetch GitHub sponsors; access token might lack sufficient permissions',
      );
    }

    return {
      login: node.sponsorEntity.login,
      name: node.sponsorEntity.name,
      url: node.sponsorEntity.url,
      avatarUrl: node.sponsorEntity.avatarUrl,
      websiteUrl: node.sponsorEntity.websiteUrl,
      tierId: node.tier.id,
    };
  });

  const filteredSponsors = env.GITHUB_SPONSORS_FEATURED_TIERS
    ? sponsors.filter((sponsor) =>
        env.GITHUB_SPONSORS_FEATURED_TIERS!.includes(sponsor.tierId),
      )
    : sponsors;

  return filteredSponsors;
};

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
    console.warn('GITHUB_TOKEN not set; skipping GitHub stargazers');
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
    console.error('GraphQL errors:', result.errors);
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
