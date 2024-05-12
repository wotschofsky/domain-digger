import { env } from '@/env';

type SponsorsQueryResponse = {
  data: {
    user: {
      sponsorshipsAsMaintainer: {
        edges: {
          node: {
            sponsorEntity: {
              login: string;
              name: string;
              url: string;
              avatarUrl: string;
              websiteUrl: string | null;
            };
            tier: {
              monthlyPriceInDollars: number;
            };
          };
        }[];
      };
    };
  };
};

export const getGitHubSponsors = async (username: string) => {
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
              edges {
                node {
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
                    monthlyPriceInDollars
                  }
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
    next: {
      revalidate: 24 * 60 * 60,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub sponsors');
  }

  const body = (await response.json()) as SponsorsQueryResponse;

  return body.data.user.sponsorshipsAsMaintainer.edges.map(({ node }) => ({
    login: node.sponsorEntity.login,
    name: node.sponsorEntity.name,
    url: node.sponsorEntity.url,
    avatarUrl: node.sponsorEntity.avatarUrl,
    websiteUrl: node.sponsorEntity.websiteUrl,
    amount: node.tier.monthlyPriceInDollars,
  }));
};
