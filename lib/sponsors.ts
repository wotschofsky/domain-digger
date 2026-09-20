import { env } from '../env';

export const GITHUB_SPONSOR_USERNAME = 'wotschofsky';

export type Sponsor = {
  id: string;
  name: string;
  logoUrl: string;
  url: string;
};

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

const buildSponsorUrl = (baseUrl: string) => {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('ref', 'domain-digger');
    return url.toString();
  } catch {
    return `https://${baseUrl}?ref=domain-digger`;
  }
};

const fetchGitHubSponsors = async () => {
  if (!env.GITHUB_TOKEN) {
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
        username: GITHUB_SPONSOR_USERNAME,
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

  return env.GITHUB_SPONSORS_FEATURED_TIERS
    ? sponsors.filter((sponsor) =>
        env.GITHUB_SPONSORS_FEATURED_TIERS!.includes(sponsor.tierId),
      )
    : sponsors;
};

export const getAllSponsors = async (): Promise<Sponsor[]> => {
  const githubSponsors = await fetchGitHubSponsors();

  const allSponsors = [
    ...(env.SPONSORS ?? []),
    ...githubSponsors.map((sponsor) => ({
      id: sponsor.login,
      name: sponsor.name,
      logoUrl: sponsor.avatarUrl,
      url: sponsor.websiteUrl || sponsor.url,
    })),
  ];

  const sponsorsWithRef = allSponsors.map((sponsor) => ({
    ...sponsor,
    url: buildSponsorUrl(sponsor.url),
  }));

  return sponsorsWithRef;
};

export const getSponsorImageRemotePatterns = async () => {
  const sponsors = await getAllSponsors();

  return sponsors.map((sponsor) => {
    const url = new URL(sponsor.logoUrl);
    return { hostname: url.hostname, pathname: url.pathname };
  });
};
