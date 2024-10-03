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
    next: {
      revalidate: 24 * 60 * 60,
    },
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
