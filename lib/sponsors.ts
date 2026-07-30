import { env } from '@/env';
import { getGitHubSponsors } from '@/lib/github';

export const GITHUB_SPONSOR_USERNAME = 'wotschofsky';

export type Sponsor = {
  id: string;
  name: string;
  logoUrl: string;
  url: string;
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

export const getAllSponsors = async (): Promise<Sponsor[]> => {
  const githubSponsors = await getGitHubSponsors(GITHUB_SPONSOR_USERNAME);

  const sponsors = [
    ...(env.SPONSORS ?? []),
    ...githubSponsors.map((s) => ({
      id: s.login,
      name: s.name,
      logoUrl: s.avatarUrl,
      url: s.websiteUrl || s.url,
    })),
  ];

  const sponsorsWithRef = sponsors.map((sponsor) => ({
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
